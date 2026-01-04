import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { buildCanonicalMessage, initSodium, verifyDeviceSignature } from "../modules/auth/device-proof.js";
import type { DeviceRepository } from "../modules/auth/device-repository.js";
import type { DeviceReplayStore } from "../modules/auth/device-replay-store.js";

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
};

type DeviceAuthContext = {
  tenantId: string;
  deviceId: string;
};

export type DeviceAuthRequest = IncomingMessage & {
  context?: {
    admin?: { tenantId: string };
    device?: DeviceAuthContext;
  };
};

type DeviceAuthDeps = {
  deviceRepository: DeviceRepository;
  replayStore: DeviceReplayStore;
};

type Next = () => void | Promise<void>;

const SKEW_SECONDS = 30;
const REPLAY_TTL_MS = 90_000;

function problem(
  status: number,
  title: string,
  detail: string,
  instance: string,
  error_code?: string
): ProblemDetails {
  return {
    type: `https://errors.lokaltreu.example/${error_code || "request"}`,
    title,
    status,
    detail,
    instance,
    error_code,
    correlation_id: randomUUID(),
  };
}

function sendProblem(res: ServerResponse, payload: ProblemDetails) {
  res.statusCode = payload.status;
  res.setHeader("Content-Type", "application/problem+json");
  res.end(JSON.stringify(payload));
}

function readHeader(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

function getTenantId(req: DeviceAuthRequest): string | null {
  if (req.context?.admin?.tenantId) {
    return req.context.admin.tenantId;
  }
  return readHeader(req, "x-tenant-id");
}

function getDeviceKey(req: IncomingMessage): string | null {
  return readHeader(req, "x-device-key") ?? readHeader(req, "x-device-id");
}

function getDeviceProof(req: IncomingMessage): string | null {
  return readHeader(req, "x-device-proof") ?? readHeader(req, "x-device-signature");
}

function normalizePath(prefix: string, path: string): string {
  if (!prefix || prefix === "/") {
    return path;
  }
  const left = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}

function getCanonicalPath(req: IncomingMessage): string {
  const path = req.url?.split("?")[0] ?? "/";
  if (!process.env.TRUST_PROXY) {
    return path;
  }
  const forwardedPrefix = readHeader(req, "x-forwarded-prefix");
  if (!forwardedPrefix) {
    return path;
  }
  return normalizePath(forwardedPrefix, path);
}

function isRewardsRedeem(path: string): boolean {
  return path === "/rewards/redeem";
}

function getJti(req: DeviceAuthRequest, path: string): string | null {
  if (isRewardsRedeem(path)) {
    const body = (req as { body?: unknown }).body;
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      const redeemToken = (body as Record<string, unknown>)["redeemToken"];
      return typeof redeemToken === "string" ? redeemToken : null;
    }
    return null;
  }
  return readHeader(req, "x-device-nonce");
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createDeviceAuthMiddleware(deps: DeviceAuthDeps) {
  const replayCache = new Map<string, number>();

  return async function deviceAuth(req: DeviceAuthRequest, res: ServerResponse, next: Next) {
    const path = req.url?.split("?")[0] ?? "/";
    const isRedeem = isRewardsRedeem(path);
    const authStatus = isRedeem ? 403 : 401;
    const authTitle = authStatus === 401 ? "Unauthorized" : "Forbidden";
    const errorCode = isRedeem ? undefined : "DEVICE_PROOF_INVALID";

    const deviceKey = getDeviceKey(req);
    const timestampRaw = readHeader(req, "x-device-timestamp");
    const jti = getJti(req, path);
    const signature = getDeviceProof(req);
    const tenantId = getTenantId(req);

    if (!deviceKey || !timestampRaw || !signature) {
      sendProblem(res, problem(authStatus, authTitle, "Missing device proof headers", req.url ?? "/", errorCode));
      return;
    }

    if (!jti) {
      // For /rewards/redeem, the JTI is derived from the request body.
      // When it is missing, treat this as an invalid proof rather than a body schema error.
      sendProblem(res, problem(authStatus, authTitle, "Missing device proof JTI", req.url ?? "/", errorCode));
      return;
    }

    const timestamp = parseTimestamp(timestampRaw);
    if (timestamp === null) {
      sendProblem(
        res,
        problem(authStatus, authTitle, "Invalid device timestamp", req.url ?? "/", errorCode)
      );
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > SKEW_SECONDS) {
      const skewCode = isRedeem ? undefined : "DEVICE_PROOF_SKEW";
      sendProblem(res, problem(authStatus, authTitle, "Device timestamp skew", req.url ?? "/", skewCode));
      return;
    }

    const record = tenantId
      ? await deps.deviceRepository.findById({ tenantId, deviceId: deviceKey })
      : await deps.deviceRepository.findByKey({ deviceKey });
    // A device is considered enabled only when a record exists and enabled === true.
    if (!record || !record.enabled) {
      if (process.env.API_PROFILE === "dev") {
        const reason = record ? "disabled flag set" : "missing record";
        console.warn(`DEVICE_DISABLED dev: ${tenantId ?? "?"}/${deviceKey} reason=${reason}`);
      }
      sendProblem(res, problem(403, "Forbidden", "Device disabled", req.url ?? "/", isRedeem ? undefined : "DEVICE_DISABLED"));
      return;
    }

    if (tenantId && tenantId !== record.tenantId) {
      sendProblem(res, problem(403, "Forbidden", "Tenant mismatch", req.url ?? "/", isRedeem ? undefined : "DEVICE_PROOF_INVALID"));
      return;
    }

    if (!isRedeem) {
      const resolvedTenantId = tenantId ?? record.tenantId;
      const replayKey = `replay:device-proof:${resolvedTenantId}:${record.deviceId}:${jti}`;
      const nowMs = Date.now();
      const cachedUntil = replayCache.get(replayKey);
      if (cachedUntil !== undefined && cachedUntil > nowMs) {
        sendProblem(
          res,
          problem(409, "Conflict", "Device proof replay detected", req.url ?? "/", "DEVICE_PROOF_REPLAY")
        );
        return;
      }
      if (cachedUntil !== undefined && cachedUntil <= nowMs) {
        replayCache.delete(replayKey);
      }

      const replayOk = await deps.replayStore.consume({
        tenantId: resolvedTenantId,
        deviceId: record.deviceId,
        jti: replayKey,
        expiresAt: timestamp,
      });
      if (!replayOk) {
        sendProblem(
          res,
          problem(409, "Conflict", "Device proof replay detected", req.url ?? "/", "DEVICE_PROOF_REPLAY")
        );
        return;
      }
      replayCache.set(replayKey, nowMs + REPLAY_TTL_MS);
    }

    await initSodium();
    const canonicalPath = getCanonicalPath(req);
    const message = buildCanonicalMessage({
      method: (req.method ?? "GET").toUpperCase(),
      path: canonicalPath,
      timestamp: timestampRaw,
      jti,
    });
    const valid = verifyDeviceSignature({
      publicKey: record.publicKey,
      signature,
      message,
    });
    if (!valid) {
      sendProblem(res, problem(authStatus, authTitle, "Invalid device proof", req.url ?? "/", errorCode));
      return;
    }

    req.context = {
      ...(req.context ?? {}),
      device: {
        tenantId: record.tenantId,
        deviceId: record.deviceId,
      },
    };

    await next();
  };
}
