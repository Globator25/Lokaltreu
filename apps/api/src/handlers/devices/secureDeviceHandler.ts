import type { Request, Response } from "express";
import { SECURE_DEVICE_OK_RESPONSE } from "@lokaltreu/types";
import { auditEvent } from "../../audit/auditEvent.js";
import { rejectDeviceProof, verifyDeviceProof } from "../../security/device/verifyDeviceProof.js";

export async function secureDeviceHandler(req: Request, res: Response): Promise<void> {
  const result = await verifyDeviceProof(req);
  const requestId =
    typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "unknown-request";

  // Audit-Pflicht (SPEC v2.0): Jeder Proof wird WORM-append protokolliert (Retention 180 Tage, Export R2 EU).
  await auditEvent({
    type: "secure_device.attempt",
    at: new Date().toISOString(),
    actorDeviceId: result.deviceId ?? "unknown-device",
    requestId,
    meta: {
      result: result.ok ? "ok" : "failed",
      reason: result.reason ?? "none",
    },
  });

  if (result.ok) {
    res.status(200).type("application/json").json(SECURE_DEVICE_OK_RESPONSE);
    return;
  }

  rejectDeviceProof(res, result.reason ?? "INVALID_SIGNATURE");
}
