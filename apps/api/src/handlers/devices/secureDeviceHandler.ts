import type { Request, Response } from "express";
import { SECURE_DEVICE_OK_RESPONSE } from "@lokaltreu/types";
import { auditEvent } from "../../audit/auditEvent.js";
import { rejectDeviceProof, verifyDeviceProof } from "../../security/device/verifyDeviceProof.js";

function readHeader(req: Request, name: string): string | undefined {
  const viaGet = req.get(name);
  if (viaGet && viaGet.trim().length > 0) {
    return viaGet;
  }

  const raw = req.headers[name.toLowerCase() as keyof typeof req.headers];
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  return undefined;
}

export async function secureDeviceHandler(req: Request, res: Response): Promise<void> {
  const result = await verifyDeviceProof(req);
  const requestId = readHeader(req, "x-request-id") ?? "unknown-request";
  const tenantId = readHeader(req, "x-tenant-id") ?? "unknown-tenant";
  const deviceId = result.deviceId ?? readHeader(req, "x-device-id") ?? "unknown-device";
  const ip = req.ip ?? "unknown-ip";
  const userAgent = readHeader(req, "user-agent") ?? "unknown-ua";
  const jti = readHeader(req, "x-device-jti") ?? requestId;
  const correlationId = readHeader(req, "x-correlation-id") ?? jti;

  if (result.ok) {
    await auditEvent({
      type: "secure_device.ok",
      at: new Date().toISOString(),
      actorDeviceId: deviceId,
      requestId,
      meta: {
        tenantId,
        actorType: "device",
        action: "secure_device",
        result: "ok",
        deviceId,
        ip,
        userAgent,
        jti,
        correlationId,
      },
    });

    res.status(200).type("application/json").json(SECURE_DEVICE_OK_RESPONSE);
    return;
  }

  await auditEvent({
    type: "secure_device.proof_failed",
    at: new Date().toISOString(),
    actorDeviceId: deviceId,
    requestId,
    meta: {
      tenantId,
      actorType: "device",
      action: "secure_device",
      result: "failed",
      deviceId,
      ip,
      userAgent,
      jti,
      reason: result.reason ?? "UNKNOWN",
      correlationId,
    },
  });

  rejectDeviceProof(res, result.reason ?? "INVALID_SIGNATURE", correlationId);
}
