// apps/api/src/mw/idempotency.ts  

export interface StoredResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Abstrakte Schnittstelle für Idempotenz-Speicher.
 * Prod: Redis, Tests/Dev: In-Memory.
 */
export interface IdempotencyStore {
  getResult(key: string): Promise<StoredResult | null>;
  /**
   * Versucht, einen neuen Eintrag mit TTL anzulegen.
   * Gibt true zurück, wenn dieser Request der "Leader" ist.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  /**
   * Speichert das finale Ergebnis für Replays.
   */
  setResult(key: string, value: StoredResult, ttlSeconds: number): Promise<void>;
  /**
   * Gibt einen Lock frei, ohne ein Ergebnis zu speichern.
   */
  releaseLock(key: string): Promise<void>;
}

/**
 * Sehr einfache In-Memory-Implementierung.
 * Nur für lokale Tests/Dev, nicht für mehrere Instanzen geeignet.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly data = new Map<string, { result?: StoredResult; expiresAt: number }>();

  getResult(key: string): Promise<StoredResult | null> {
    const entry = this.data.get(key);
    if (!entry) return Promise.resolve(null);
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.result ?? null);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const existing = await this.getResult(key);
    if (existing || this.data.has(key)) {
      // bereits gelockt oder abgeschlossen
      return false;
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.data.set(key, {
      result: undefined,
      expiresAt,
    });
    return true;
  }

  setResult(key: string, value: StoredResult, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.data.set(key, { result: value, expiresAt });
    return Promise.resolve();
  }

  releaseLock(key: string): Promise<void> {
    const entry = this.data.get(key);
    if (!entry) {
      return Promise.resolve();
    }
    if (!entry.result) {
      this.data.delete(key);
    }
    return Promise.resolve();
  }
}

export function createIdempotencyStore(): IdempotencyStore {
  const kind = process.env.IDEMPOTENCY_STORE;
  if (kind === "redis") {
    return createRedisIdempotencyStore();
  }
  return new InMemoryIdempotencyStore();
}

import crypto from "crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createRedisIdempotencyStore } from "../services/idempotencyStore/redis.js";

/**
 * 24h TTL gem. SPEC / Idempotency-Key.
 */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 86400

export interface IdempotencyScopeInput {
  tenantId: string | undefined;
  routeId: string;
  body: unknown;
  idempotencyKey: string | null | undefined;
}

/**
 * Prüft den Idempotency-Key gemäß OpenAPI-Schema:
 * type: string, minLength: 8, maxLength: 128
 */
export function validateIdempotencyKey(key: string | null | undefined): string | null {
  if (!key) return "Idempotency-Key header is required";
  if (key.length < 8) return "Idempotency-Key must be at least 8 characters";
  if (key.length > 128) return "Idempotency-Key must be at most 128 characters";
  return null;
}

/**
 * Bildet den Scope {tenantId, route, bodyHash} wie in SPEC beschrieben.
 * tenantId darf undefined sein (z. B. anonyme Flows), wird dann durch "-" ersetzt.
 */
export function buildIdempotencyKey({
  tenantId,
  routeId,
  body,
  idempotencyKey,
}: IdempotencyScopeInput): string {
  const stableBodyJson = JSON.stringify(body ?? null);
  const bodyHash = crypto.createHash("sha256").update(stableBodyJson, "utf8").digest("hex");
  const tenantPart = tenantId ?? "-";
  const base = `${tenantPart}|${routeId}|${bodyHash}`;
  return `idem:${base}:${idempotencyKey}`;
}

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
};

type IdempotencyRequest = IncomingMessage & {
  context?: {
    tenantId?: string;
    correlationId?: string;
    admin?: { tenantId: string };
    device?: { tenantId: string };
  };
  body?: unknown;
  path?: string;
  route?: { path?: string };
};

type IdempotencyResponse = ServerResponse & {
  status: (code: number) => IdempotencyResponse;
  type: (contentType: string) => IdempotencyResponse;
  send: (body?: unknown) => void;
};

const IDEMPOTENCY_WRAPPED = Symbol("idempotencyWrapped");

type IdempotentServerResponse = ServerResponse<IncomingMessage> & {
  [IDEMPOTENCY_WRAPPED]?: boolean;
};

function toResponse(res: ServerResponse): IdempotencyResponse {
  const response = res as IdempotencyResponse;
  if (typeof response.status !== "function") {
    response.status = (code: number) => {
      res.statusCode = code;
      return response;
    };
  }
  if (typeof response.type !== "function") {
    response.type = (contentType: string) => {
      res.setHeader("Content-Type", contentType);
      return response;
    };
  }
  if (typeof response.send !== "function") {
    response.send = (body?: unknown) => {
      if (body === undefined) {
        res.end();
        return;
      }
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        res.end(body);
        return;
      }
      res.end(JSON.stringify(body));
    };
  }
  return response;
}

function problem(
  status: number,
  title: string,
  detail: string,
  instance: string,
  error_code?: string,
  correlationId?: string
): ProblemDetails {
  return {
    type: `https://errors.lokaltreu.example/${error_code || "request"}`,
    title,
    status,
    detail,
    instance,
    error_code,
    correlation_id: correlationId ?? randomUUID(),
  };
}

function sendProblem(res: IdempotencyResponse, payload: ProblemDetails) {
  res.status(payload.status).type("application/problem+json").send(payload);
}

function getIdempotencyKey(req: IdempotencyRequest): string | undefined {
  const rawKey = req.headers["idempotency-key"];
  if (typeof rawKey === "string") {
    return rawKey;
  }
  if (Array.isArray(rawKey)) {
    return rawKey[0];
  }
  return undefined;
}

function isHotRoute(req: IncomingMessage): boolean {
  const method = req.method ?? "GET";
  const path = req.url?.split("?")[0] ?? "/";
  return method === "POST" && (path === "/stamps/claim" || path === "/rewards/redeem");
}

function getRouteId(req: IdempotencyRequest): string {
  const method = req.method ?? "GET";
  const path = req.route?.path ?? req.path ?? req.url?.split("?")[0] ?? "/";
  return `${method} ${path}`;
}

function getTenantId(req: IdempotencyRequest): string | undefined {
  return req.context?.tenantId ?? req.context?.admin?.tenantId ?? req.context?.device?.tenantId;
}

function logStoreError(input: {
  routeId: string;
  tenantId: string | undefined;
  correlationId: string | undefined;
  error: unknown;
}) {
  console.warn({
    event: "idempotency_store_unavailable",
    routeId: input.routeId,
    tenant_id: input.tenantId,
    correlation_id: input.correlationId ?? randomUUID(),
    error: input.error instanceof Error ? input.error.message : "unknown",
  });
}

export function createIdempotencyMiddleware(store?: IdempotencyStore) {
  const resolvedStore = store ?? createIdempotencyStore();
  return async function requireIdempotency(
    req: IdempotencyRequest,
    res: ServerResponse,
    next?: () => void
  ): Promise<boolean> {
    const response = toResponse(res);
    if (!isHotRoute(req)) {
      if (next) {
        next();
      }
      return true;
    }

    const keyHeader = getIdempotencyKey(req);
    const validationError = validateIdempotencyKey(keyHeader);
    if (validationError) {
      sendProblem(
        response,
        problem(
          400,
          "Bad Request",
          validationError,
          req.url ?? "/",
          "IDEMPOTENCY_KEY_INVALID",
          req.context?.correlationId
        )
      );
      return false;
    }

    const routeId = getRouteId(req);
    const tenantId = getTenantId(req);
    const idempotencyKey = buildIdempotencyKey({
      tenantId,
      routeId,
      body: req.body,
      idempotencyKey: keyHeader,
    });

    let existing: StoredResult | null = null;
    try {
      existing = await resolvedStore.getResult(idempotencyKey);
    } catch (error) {
      logStoreError({ routeId, tenantId, correlationId: req.context?.correlationId, error });
      existing = null;
    }
    if (existing) {
      console.warn({
        event: "idempotency",
        action: "replay",
        routeId,
        tenant_id: tenantId,
        correlation_id: req.context?.correlationId ?? randomUUID(),
      });
      res.statusCode = existing.status;
      for (const [header, value] of Object.entries(existing.headers)) {
        res.setHeader(header, value);
      }
      res.end(existing.body);
      return false;
    }

    let acquired = false;
    try {
      acquired = await resolvedStore.acquireLock(idempotencyKey, IDEMPOTENCY_TTL_SECONDS);
    } catch (error) {
      logStoreError({ routeId, tenantId, correlationId: req.context?.correlationId, error });
      acquired = true;
    }
    if (!acquired) {
      console.warn({
        event: "idempotency",
        action: "conflict",
        routeId,
        tenant_id: tenantId,
        correlation_id: req.context?.correlationId ?? randomUUID(),
      });
      sendProblem(
        response,
        problem(
          409,
          "Conflict",
          "Idempotency conflict",
          req.url ?? "/",
          "IDEMPOTENCY_CONFLICT",
          req.context?.correlationId
        )
      );
      return false;
    }

    const chunks: Buffer[] = [];
    const writableRes: ServerResponse<IncomingMessage> = res;
    const resWithFlag: IdempotentServerResponse = res;

    if (resWithFlag[IDEMPOTENCY_WRAPPED]) {
      if (next) {
        next();
      }
      return true;
    }
    resWithFlag[IDEMPOTENCY_WRAPPED] = true;

    // Original write/end gebunden sichern, damit das "this"-Binding erhalten bleibt.
    // Wir rufen immer originalWrite/originalEnd auf, um Rekursion zu vermeiden.
    const originalWrite = writableRes.write.bind(writableRes) as typeof writableRes.write;
    const originalEnd = writableRes.end.bind(writableRes) as typeof writableRes.end;

    const toBuffer = (chunk: string | Buffer, encoding?: BufferEncoding) => {
      if (typeof chunk === "string") {
        return Buffer.from(chunk, encoding);
      }
      return chunk;
    };

    const wrappedWrite = (
      chunk: unknown,
      encodingOrCb?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void
    ) => {
      if (typeof chunk === "string" || Buffer.isBuffer(chunk)) {
        const encoding = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
        chunks.push(toBuffer(chunk, encoding));
      }
      return originalWrite(chunk as never, encodingOrCb as never, cb as never);
    };

    const wrappedEnd = (
      chunk?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void
    ) => {
      if (typeof chunk === "string" || Buffer.isBuffer(chunk)) {
        const encoding = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
        chunks.push(toBuffer(chunk, encoding));
      }

      const rawBody = Buffer.concat(chunks).toString("utf8");

      // Idempotency store hook (place to persist response metadata/body):
      // const idemKey = req.headers["idempotency-key"];
      // const headers = res.getHeaders();
      // void store.setResult(idemKey, { status: res.statusCode, headers, body: rawBody }, IDEMPOTENCY_TTL_SECONDS);
      const status = res.statusCode || 500;
      if (status < 500) {
        const headers = res.getHeaders();
        const headerRecord: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
          if (typeof value === "string") {
            headerRecord[key] = value;
          } else if (Array.isArray(value)) {
            headerRecord[key] = value.join(", ");
          }
        }
        if (!headerRecord["Content-Type"]) {
          const contentType = res.getHeader("Content-Type");
          if (typeof contentType === "string") {
            headerRecord["Content-Type"] = contentType;
          }
        }
        headerRecord["Idempotency-Key"] = keyHeader ?? "";
        void (async () => {
          try {
            await resolvedStore.setResult(
              idempotencyKey,
              {
                status,
                headers: headerRecord,
                body: rawBody,
              },
              IDEMPOTENCY_TTL_SECONDS
            );
          } catch (error) {
            logStoreError({ routeId, tenantId, correlationId: req.context?.correlationId, error });
          }
        })();
      } else {
        void (async () => {
          try {
            await resolvedStore.releaseLock(idempotencyKey);
          } catch (error) {
            logStoreError({ routeId, tenantId, correlationId: req.context?.correlationId, error });
          }
        })();
      }

      // Optional: restore original methods to avoid multiple wrapping.
      writableRes.write = originalWrite;
      writableRes.end = originalEnd;

      return originalEnd(chunk as never, encodingOrCb as never, cb as never);
    };

    writableRes.write = wrappedWrite;
    writableRes.end = wrappedEnd;

    if (next) {
      next();
    }
    return true;
  };
}
