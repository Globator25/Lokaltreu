import type { Request, Response } from "express";
import { SECURE_DEVICE_OK_RESPONSE } from "@lokaltreu/types";
import { auditEvent } from "../../audit/auditEvent.js";
import { rejectDeviceProof, verifyDeviceProof } from "../../security/device/verifyDeviceProof.js";

export async function secureDeviceHandler(req: Request, res: Response): Promise<void> {
  const result = await verifyDeviceProof(req);
  const requestId =
    typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "unknown-request";
  const tenantId = req.get("x-tenant-id") ?? "unknown-tenant";
  const deviceId = result.deviceId ?? req.get("x-device-id") ?? "unknown-device";
  const ip = req.ip ?? "unknown-ip";
  const userAgent = req.get("user-agent") ?? "unknown-ua";
  const jti = req.get("x-device-jti") ?? requestId;

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
    },
  });

  rejectDeviceProof(res, result.reason ?? "INVALID_SIGNATURE");
}
