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

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createDeviceAuthMiddleware(deps: DeviceAuthDeps) {
  const replayCache = new Map<string, number>();

  return async function deviceAuth(req: DeviceAuthRequest, res: ServerResponse, next: Next) {
    const deviceId = readHeader(req, "x-device-id");
    const timestampRaw = readHeader(req, "x-device-timestamp");
    const nonce = readHeader(req, "x-device-nonce");
    const signature = readHeader(req, "x-device-signature");
    const tenantId = getTenantId(req);

    if (!tenantId || !deviceId || !timestampRaw || !nonce || !signature) {
      sendProblem(res, problem(401, "Unauthorized", "Missing device proof headers", req.url ?? "/", "DEVICE_PROOF_INVALID"));
      return;
    }

    const timestamp = parseTimestamp(timestampRaw);
    if (timestamp === null) {
      sendProblem(
        res,
        problem(401, "Unauthorized", "Invalid device timestamp", req.url ?? "/", "DEVICE_PROOF_INVALID")
      );
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > SKEW_SECONDS) {
      sendProblem(res, problem(401, "Unauthorized", "Device timestamp skew", req.url ?? "/", "DEVICE_PROOF_SKEW"));
      return;
    }

    const replayKey = `replay:device-proof:${tenantId}:${deviceId}:${nonce}`;
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
      tenantId,
      deviceId,
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

    const record = await deps.deviceRepository.findById({ tenantId, deviceId });
    // A device is considered enabled only when a record exists and enabled === true.
    if (!record || !record.enabled) {
      if (process.env.API_PROFILE === "dev") {
        const reason = record ? "disabled flag set" : "missing record";
        console.warn(`DEVICE_DISABLED dev: ${tenantId}/${deviceId} reason=${reason}`);
      }
      sendProblem(res, problem(403, "Forbidden", "Device disabled", req.url ?? "/", "DEVICE_DISABLED"));
      return;
    }

    await initSodium();
    const path = req.url?.split("?")[0] ?? "/";
    const message = buildCanonicalMessage({
      method: (req.method ?? "GET").toUpperCase(),
      path,
      timestamp: timestampRaw,
      nonce,
    });
    const valid = verifyDeviceSignature({
      publicKey: record.publicKey,
      signature,
      message,
    });
    if (!valid) {
      sendProblem(res, problem(401, "Unauthorized", "Invalid device signature", req.url ?? "/", "DEVICE_PROOF_INVALID"));
      return;
    }

    req.context = {
      ...(req.context ?? {}),
      device: {
        tenantId,
        deviceId,
      },
    };

    await next();
  };
}
