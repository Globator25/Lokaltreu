import type { Request, Response } from 'express';
import { SECURE_ACTION_OK_RESPONSE, createTokenReuseProblem } from '../../runtime/contracts.js';
import { auditEvent } from '../../audit/auditEvent.js';
import { emitSecurityMetric } from '../../security/observability.js';
import { getReplayStore } from '../../security/tokens/replayStore.js';

function readHeader(req: Request, name: string): string | undefined {
  const viaGet = req.get(name);
  if (viaGet && viaGet.trim().length > 0) {
    return viaGet;
  }
  const raw = req.headers[name.toLowerCase() as keyof typeof req.headers];
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === 'string' && value.trim().length > 0) as
      | string
      | undefined;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw;
  }
  return undefined;
}

export async function secureActionHandler(req: Request, res: Response): Promise<void> {
  const jti = readHeader(req, 'x-device-jti') ?? '';
  const deviceId = readHeader(req, 'x-device-id') ?? 'unknown-device';
  const tenantId = readHeader(req, 'x-tenant-id') ?? 'unknown-tenant';
  const requestId = readHeader(req, 'x-request-id') ?? 'unknown-request';
  const ip = req.ip ?? 'unknown-ip';
  const userAgent = readHeader(req, 'user-agent') ?? 'unknown-ua';
  const correlationId = readHeader(req, 'x-correlation-id') ?? (jti || requestId);
  // TODO: In Produktion MUSS tenantId aus Auth-Context kommen (SPEC verlangt Zuordnung zu Tenant).
  // TODO: In Produktion MUSS deviceId aus Geraetebindung kommen (SPEC verlangt Zuordnung zu Geraet).

  const store = getReplayStore();
  const first = await store.firstUse(jti, 60); // 60s TTL ist MUSS laut SPEC

  if (!first) {
    emitSecurityMetric({
      name: 'rate_token_reuse',
      attributes: {
        tenantId,
      },
    });

    await auditEvent({
      type: 'secure_action.blocked_replay',
      at: new Date().toISOString(),
      actorDeviceId: deviceId,
      requestId: jti || requestId,
      meta: {
        tenantId,
        actorType: 'device',
        action: 'secure_action',
        result: 'blocked_replay',
        deviceId,
        ip,
        userAgent,
        jti: jti || requestId,
        reason: 'TOKEN_REUSE',
        ttlSeconds: 60,
        correlationId,
      },
    });

    res.status(409).type('application/problem+json').json(createTokenReuseProblem(correlationId));
    return;
  }

  await auditEvent({
    type: 'secure_action.ok',
    at: new Date().toISOString(),
    actorDeviceId: deviceId,
    requestId: jti || requestId,
    meta: {
      tenantId,
      actorType: 'device',
      action: 'secure_action',
      result: 'ok',
      deviceId,
      ip,
      userAgent,
      jti: jti || requestId,
      correlationId,
    },
  });

  res.status(200).type('application/json').json(SECURE_ACTION_OK_RESPONSE);
}
