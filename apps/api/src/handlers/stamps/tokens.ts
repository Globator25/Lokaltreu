import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import type { DeviceAuthRequest } from "../../middleware/device-auth.js";
import { problem, sendJson, sendProblem } from "../http-utils.js";
import {
  buildIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  validateIdempotencyKey,
  type IdempotencyStore,
} from "../../mw/idempotency.js";
import type { StampService } from "../../modules/stamps/stamp.service.js";

type StampTokenRequest = AdminAuthRequest & DeviceAuthRequest;

type StampTokenHandlerDeps = {
  service: StampService;
  idempotencyStore?: IdempotencyStore;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

export async function handleStampTokens(
  req: StampTokenRequest,
  res: ServerResponse,
  deps: StampTokenHandlerDeps,
) {
  const rawKey = req.headers["idempotency-key"];
  const idempotencyKey = typeof rawKey === "string" ? rawKey : Array.isArray(rawKey) ? rawKey[0] : undefined;
  const validationError = validateIdempotencyKey(idempotencyKey);
  if (validationError) {
    return sendProblem(
      res,
      problem(400, "Bad Request", validationError, req.url ?? "/stamps/tokens"),
    );
  }

  const tenantId = req.context?.device?.tenantId ?? req.context?.admin?.tenantId;
  const deviceId = req.context?.device?.deviceId;
  if (!tenantId) {
    return sendProblem(
      res,
      problem(403, "Forbidden", "Missing tenant context", req.url ?? "/stamps/tokens"),
    );
  }

  const store = deps.idempotencyStore;
  const scopedKey = store
    ? buildIdempotencyKey({
        tenantId,
        routeId: "POST /stamps/tokens",
        body: null,
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
        problem(409, "Conflict", "Idempotency conflict", req.url ?? "/stamps/tokens"),
      );
    }
  }

  try {
    const { qrToken, jti, expiresAt } = await deps.service.createToken({
      tenantId,
      deviceId,
    });

    res.setHeader("Idempotency-Key", idempotencyKey);

    const payload = {
      qrToken,
      jti,
      expiresAt: expiresAt.toISOString(),
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
    deps.logger?.error?.("stamp token creation failed", error);
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/stamps/tokens",
      ),
    );
  }
}
