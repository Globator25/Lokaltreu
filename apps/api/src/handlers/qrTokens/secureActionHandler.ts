import type { Request, Response } from "express";
import { SECURE_ACTION_OK_RESPONSE, createTokenReuseProblem } from "@lokaltreu/types";
import { auditEvent } from "../../audit/auditEvent.js";
import { emitSecurityMetric } from "../../security/observability.js";
import { getReplayStore } from "../../security/tokens/replayStore.js";

export async function secureActionHandler(req: Request, res: Response): Promise<void> {
  const jti = req.header("x-device-jti") ?? "";
  const deviceId = req.header("x-device-id") ?? "unknown-device";
  const tenantId = "unknown-tenant";
  const requestId =
    typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "unknown-request";
  // TODO: In Produktion MUSS tenantId aus Auth-Context kommen (SPEC verlangt Zuordnung zu Tenant).
  // TODO: In Produktion MUSS deviceId aus Gerätebindung kommen (SPEC verlangt Zuordnung zu Gerät).

  const store = getReplayStore();
  const first = await store.firstUse(jti, 60); // 60s TTL ist MUSS laut SPEC

  if (!first) {
    emitSecurityMetric({
      name: "rate_token_reuse",
      attributes: {
        tenantId,
      },
    });

    // Audit-Pflicht: Jeder Replay-Versuch wird unveränderlich protokolliert.
    // Forensik laut SPEC.
    await auditEvent({
      type: "secure_action.blocked_replay",
      at: new Date().toISOString(),
      actorDeviceId: deviceId,
      requestId: jti || requestId,
      meta: {
        tenantId,
        reason: "TOKEN_REUSE",
        ttlSeconds: 60,
      },
    });

    res.status(429).type("application/problem+json").json(createTokenReuseProblem());
    return;
  }

  await auditEvent({
    type: "secure_action.ok",
    at: new Date().toISOString(),
    actorDeviceId: deviceId,
    requestId: jti || requestId,
    meta: {
      tenantId,
    },
  });

  res.status(200).type("application/json").json(SECURE_ACTION_OK_RESPONSE);
}
