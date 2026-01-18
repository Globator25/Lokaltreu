import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../mw/admin-auth.js";
import { problem, readJsonBody, sendJson, sendProblem } from "./http-utils.js";
import { toProblemDetails } from "../problem/to-problem-details.js";
import {
  buildIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  validateIdempotencyKey,
  type IdempotencyStore,
} from "../mw/idempotency.js";
import type {
  DsrRequestType,
  DsrSubjectType,
} from "../repositories/dsr-requests-repo.js";
import {
  DsrRequestAlreadyFulfilledError,
  DsrRequestInvalidActionError,
  DsrRequestNotFoundError,
  type DsrFulfillAction,
} from "../services/dsr-service.js";

type DsrHandlerDeps = {
  service: {
    createDsrRequest: (params: {
      tenantId: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      reason: string | null;
    }) => Promise<{
      id: string;
      status: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      createdAt: Date;
      fulfilledAt: Date | null;
    }>;
    getDsrRequest: (params: { tenantId: string; dsrRequestId: string }) => Promise<{
      id: string;
      status: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      createdAt: Date;
      fulfilledAt: Date | null;
    }>;
    fulfillDsrRequest: (params: {
      tenantId: string;
      dsrRequestId: string;
      action: DsrFulfillAction | null;
      correlationId?: string;
    }) => Promise<{
      id: string;
      status: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      createdAt: Date;
      fulfilledAt: Date | null;
    }>;
  };
  idempotencyStore?: IdempotencyStore;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

type DsrRequest = AdminAuthRequest & {
  body?: unknown;
  context?: {
    admin?: { tenantId: string };
    correlation_id?: string;
    correlationId?: string;
  };
};

function readHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveTenantId(req: DsrRequest, res: ServerResponse): string | null {
  const adminTenantId = req.context?.admin?.tenantId;
  if (!adminTenantId) {
    sendProblem(res, problem(403, "Forbidden", "Missing admin context", req.url ?? "/dsr/requests"));
    return null;
  }
  const headerTenantId = readHeader(req, "x-tenant-id");
  if (!headerTenantId) {
    sendProblem(res, problem(401, "Unauthorized", "Missing tenant context", req.url ?? "/dsr/requests"));
    return null;
  }
  if (headerTenantId !== adminTenantId) {
    sendProblem(res, problem(403, "Forbidden", "Tenant mismatch", req.url ?? "/dsr/requests"));
    return null;
  }
  return headerTenantId;
}

function resolveIdempotencyKey(
  req: IncomingMessage,
  res: ServerResponse,
  instance: string,
): string | null {
  const rawKey = req.headers["idempotency-key"];
  const key = typeof rawKey === "string" ? rawKey : Array.isArray(rawKey) ? rawKey[0] : undefined;
  if (!key) {
    sendProblem(
      res,
      problem(400, "Bad Request", "Idempotency-Key header is required", instance, "IDEMPOTENCY_KEY_REQUIRED"),
    );
    return null;
  }
  const validationError = validateIdempotencyKey(key);
  if (validationError) {
    sendProblem(
      res,
      problem(400, "Bad Request", validationError, instance, "IDEMPOTENCY_KEY_INVALID"),
    );
    return null;
  }
  return key;
}

function parseSubject(input: unknown): { subjectType: DsrSubjectType; subjectId: string } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const subjectType = record["subject_type"];
  const subjectId = record["subject_id"];
  if (subjectType !== "card_id" && subjectType !== "device_id" && subjectType !== "subject_id") {
    return null;
  }
  if (typeof subjectId !== "string" || subjectId.trim().length === 0 || subjectId.length > 128) {
    return null;
  }
  return { subjectType, subjectId: subjectId.trim() };
}

function parseRequestType(input: unknown): DsrRequestType | null {
  if (input === "DELETE" || input === "ERASURE") {
    return input;
  }
  return null;
}

function parseAction(input: unknown): DsrFulfillAction | null | "invalid" {
  if (input === undefined) {
    return null;
  }
  if (input === "DELETE" || input === "PSEUDONYMIZE") {
    return input;
  }
  return "invalid";
}

export async function handleCreateDsrRequest(
  req: DsrRequest,
  res: ServerResponse,
  deps: DsrHandlerDeps,
) {
  const tenantId = resolveTenantId(req, res);
  if (!tenantId) {
    return;
  }
  const idempotencyKey = resolveIdempotencyKey(req, res, req.url ?? "/dsr/requests");
  if (!idempotencyKey) {
    return;
  }

  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/dsr/requests"),
    );
  }

  const requestType = parseRequestType(body.requestType);
  if (!requestType) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid requestType", req.url ?? "/dsr/requests"),
    );
  }

  const subject = parseSubject(body.subject);
  if (!subject) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid subject", req.url ?? "/dsr/requests"),
    );
  }

  const reasonValue = body.reason;
  if (reasonValue !== undefined && typeof reasonValue !== "string") {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid reason", req.url ?? "/dsr/requests"),
    );
  }
  const reason = typeof reasonValue === "string" ? reasonValue.trim() : null;
  if (reason && reason.length > 256) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Reason too long", req.url ?? "/dsr/requests"),
    );
  }

  const store = deps.idempotencyStore;
  const idempotencyBody = {
    requestType,
    subject: {
      subject_type: subject.subjectType,
      subject_id: subject.subjectId,
    },
    reason: reason ?? undefined,
  };
  const scopedKey = store
    ? buildIdempotencyKey({
        tenantId,
        routeId: "POST /dsr/requests",
        body: idempotencyBody,
        idempotencyKey,
      })
    : null;

  if (store && scopedKey) {
    const existing = await store.getResult(scopedKey);
    if (existing) {
      res.statusCode = existing.status;
      for (const [header, value] of Object.entries(existing.headers)) {
        res.setHeader(header, value);
      }
      res.end(existing.body);
      return;
    }

    const acquired = await store.acquireLock(scopedKey, IDEMPOTENCY_TTL_SECONDS);
    if (!acquired) {
      return sendProblem(
        res,
        problem(409, "Conflict", "Idempotency conflict", req.url ?? "/dsr/requests", "TOKEN_REUSE"),
      );
    }
  }

  try {
    const record = await deps.service.createDsrRequest({
      tenantId,
      requestType,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      reason,
    });

    res.setHeader("Idempotency-Key", idempotencyKey);

    const payload = {
      dsrRequestId: record.id,
      status: record.status,
      requestType: record.requestType,
      subject: {
        subject_type: record.subjectType,
        subject_id: record.subjectId,
      },
      createdAt: record.createdAt.toISOString(),
    };

    if (store && scopedKey) {
      await store.setResult(
        scopedKey,
        {
          status: 201,
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
        IDEMPOTENCY_TTL_SECONDS,
      );
    }

    return sendJson(res, 201, payload);
  } catch (error) {
    if (store && scopedKey) {
      await store.releaseLock(scopedKey);
    }
    const fallback = problem(500, "Internal Server Error", "Unexpected error", req.url ?? "/dsr/requests");
    const payload = toProblemDetails(error, fallback);
    deps.logger?.error?.("dsr request create failed", payload);
    return sendProblem(res, payload);
  }
}

export async function handleGetDsrRequest(
  req: DsrRequest,
  res: ServerResponse,
  deps: DsrHandlerDeps,
  dsrRequestId: string,
) {
  const tenantId = resolveTenantId(req, res);
  if (!tenantId) {
    return;
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(dsrRequestId)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid dsr_id", req.url ?? "/dsr/requests/{dsr_id}"),
    );
  }
  try {
    const record = await deps.service.getDsrRequest({ tenantId, dsrRequestId });
    const payload = {
      dsrRequestId: record.id,
      status: record.status,
      requestType: record.requestType,
      subject: {
        subject_type: record.subjectType,
        subject_id: record.subjectId,
      },
      createdAt: record.createdAt.toISOString(),
      fulfilledAt: record.fulfilledAt ? record.fulfilledAt.toISOString() : null,
    };
    return sendJson(res, 200, payload);
  } catch (error) {
    if (error instanceof DsrRequestNotFoundError) {
      return sendProblem(
        res,
        problem(400, "Bad Request", "Invalid dsr_id", req.url ?? "/dsr/requests/{dsr_id}"),
      );
    }
    const fallback = problem(500, "Internal Server Error", "Unexpected error", req.url ?? "/dsr/requests/{dsr_id}");
    const payload = toProblemDetails(error, fallback);
    deps.logger?.error?.("dsr request status failed", payload);
    return sendProblem(res, payload);
  }
}

export async function handleFulfillDsrRequest(
  req: DsrRequest,
  res: ServerResponse,
  deps: DsrHandlerDeps,
  dsrRequestId: string,
) {
  const tenantId = resolveTenantId(req, res);
  if (!tenantId) {
    return;
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(dsrRequestId)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid dsr_id", req.url ?? "/dsr/requests/{dsr_id}/fulfill"),
    );
  }
  const idempotencyKey = resolveIdempotencyKey(req, res, req.url ?? "/dsr/requests/{dsr_id}/fulfill");
  if (!idempotencyKey) {
    return;
  }

  const body = await readJsonBody(req);
  if (body !== undefined && body !== null && !isRecord(body)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/dsr/requests/{dsr_id}/fulfill"),
    );
  }

  const actionRaw = isRecord(body) ? body.action : undefined;
  const action = parseAction(actionRaw);
  if (action === "invalid") {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid action", req.url ?? "/dsr/requests/{dsr_id}/fulfill"),
    );
  }

  const store = deps.idempotencyStore;
  const scopedKey = store
    ? buildIdempotencyKey({
        tenantId,
        routeId: `POST /dsr/requests/${dsrRequestId}/fulfill`,
        body: body ?? null,
        idempotencyKey,
      })
    : null;

  if (store && scopedKey) {
    const existing = await store.getResult(scopedKey);
    if (existing) {
      res.statusCode = existing.status;
      for (const [header, value] of Object.entries(existing.headers)) {
        res.setHeader(header, value);
      }
      res.end(existing.body);
      return;
    }

    const acquired = await store.acquireLock(scopedKey, IDEMPOTENCY_TTL_SECONDS);
    if (!acquired) {
      return sendProblem(
        res,
        problem(409, "Conflict", "Idempotency conflict", req.url ?? "/dsr/requests/{dsr_id}/fulfill", "TOKEN_REUSE"),
      );
    }
  }

  try {
    const correlationId = req.context?.correlation_id ?? req.context?.correlationId;
    const record = await deps.service.fulfillDsrRequest({
      tenantId,
      dsrRequestId,
      action,
      correlationId,
    });

    res.setHeader("Idempotency-Key", idempotencyKey);

    const payload = {
      dsrRequestId: record.id,
      status: record.status,
      requestType: record.requestType,
      subject: {
        subject_type: record.subjectType,
        subject_id: record.subjectId,
      },
      createdAt: record.createdAt.toISOString(),
      fulfilledAt: record.fulfilledAt ? record.fulfilledAt.toISOString() : null,
    };

    if (store && scopedKey) {
      await store.setResult(
        scopedKey,
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
        IDEMPOTENCY_TTL_SECONDS,
      );
    }

    return sendJson(res, 200, payload);
  } catch (error) {
    if (store && scopedKey) {
      await store.releaseLock(scopedKey);
    }
    if (error instanceof DsrRequestNotFoundError) {
      return sendProblem(
        res,
        problem(400, "Bad Request", "Invalid dsr_id", req.url ?? "/dsr/requests/{dsr_id}/fulfill"),
      );
    }
    if (error instanceof DsrRequestInvalidActionError) {
      return sendProblem(
        res,
        problem(400, "Bad Request", "Invalid action", req.url ?? "/dsr/requests/{dsr_id}/fulfill"),
      );
    }
    if (error instanceof DsrRequestAlreadyFulfilledError) {
      return sendProblem(
        res,
        problem(409, "Conflict", "DSR request already fulfilled", req.url ?? "/dsr/requests/{dsr_id}/fulfill", "TOKEN_REUSE"),
      );
    }
    const fallback = problem(500, "Internal Server Error", "Unexpected error", req.url ?? "/dsr/requests/{dsr_id}/fulfill");
    const payload = toProblemDetails(error, fallback);
    deps.logger?.error?.("dsr request fulfill failed", payload);
    return sendProblem(res, payload);
  }
}
