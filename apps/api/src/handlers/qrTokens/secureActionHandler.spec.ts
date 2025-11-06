import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { SECURE_ACTION_OK_RESPONSE, createTokenReuseProblem } from '../../runtime/contracts.js';
import { makeRequest } from '../../test-utils/http.js';
import { secureActionHandler } from './secureActionHandler.js';
import { resetReplayStoreForTests } from '../../security/tokens/replayStore.js';

vi.mock('../../audit/auditEvent.js', () => ({
  auditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../security/observability.js', () => ({
  emitSecurityMetric: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_opts: unknown) {
      void _opts;
    }
    set(): void {
      // noop for test
    }
  },
}));

import { auditEvent } from '../../audit/auditEvent.js';
import { emitSecurityMetric } from '../../security/observability.js';

function makeRes(): {
  res: Response;
  status: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  const type = vi.fn();
  const json = vi.fn();
  const res: Partial<Response> = {};
  res.status = ((code: number) => {
    status(code);
    return res as Response;
  }) as Response['status'];
  res.type = ((value: string) => {
    type(value);
    return res as Response;
  }) as Response['type'];
  res.json = ((payload: unknown) => {
    json(payload);
    return res as Response;
  }) as Response['json'];
  res.setHeader = vi.fn() as Response['setHeader'];
  res.getHeader = vi.fn() as Response['getHeader'];
  return { res: res as Response, status, type, json };
}

function createRequest(headers: Record<string, string>, options: { requestId?: string } = {}) {
  return makeRequest({
    method: 'POST',
    path: '/secure-action',
    ip: '127.0.0.1',
    headers: {
      ...headers,
      ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
    },
  });
}

describe('secureActionHandler', () => {
  beforeEach(() => {
    resetReplayStoreForTests();
    vi.mocked(auditEvent).mockClear();
    vi.mocked(emitSecurityMetric).mockClear();
  });

  it('returns 200 and audit ok on first token use', async () => {
    const req = createRequest(
      {
        'x-device-jti': 'first-token',
        'x-device-id': 'device-ok',
        'x-tenant-id': 'tenant-1',
      },
      { requestId: 'req-1' },
    );
    const { res, status, type, json } = makeRes();

    await secureActionHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(type).toHaveBeenCalledWith('application/json');
    expect(json).toHaveBeenCalledWith(SECURE_ACTION_OK_RESPONSE);
    expect(emitSecurityMetric).not.toHaveBeenCalled();
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'secure_action.ok',
        meta: expect.objectContaining({
          action: 'secure_action',
          result: 'ok',
          ip: '127.0.0.1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('returns 409 with Problem+JSON and emits metric on replay', async () => {
    const headers = {
      'x-device-jti': 'dup-token',
      'x-device-id': 'device-replay',
      'user-agent': 'vitest-agent',
      'x-tenant-id': 'tenant-1',
    };
    const req = createRequest(headers, { requestId: 'req-replay' });
    const { res: res1 } = makeRes();
    await secureActionHandler(req, res1);

    vi.mocked(auditEvent).mockClear();
    vi.mocked(emitSecurityMetric).mockClear();

    const { res: res2, status: statusMock, type: typeMock, json: jsonMock } = makeRes();
    await secureActionHandler(req, res2);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(typeMock).toHaveBeenCalledWith('application/problem+json');
    expect(jsonMock).toHaveBeenCalledWith(createTokenReuseProblem('dup-token'));
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: 'rate_token_reuse',
      attributes: {
        tenantId: 'tenant-1',
      },
    });
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'secure_action.blocked_replay',
        meta: expect.objectContaining({
          result: 'blocked_replay',
          userAgent: 'vitest-agent',
          ip: '127.0.0.1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('ensures only one of two parallel requests succeeds while the other reports replay', async () => {
    const headers = {
      'x-device-jti': 'parallel-token',
      'x-device-id': 'device-parallel',
      'x-tenant-id': 'tenant-parallel',
    };
    const req1 = createRequest(headers, { requestId: 'req-par-1' });
    const req2 = createRequest(headers, { requestId: 'req-par-2' });
    const { res: res1, status: statusOne } = makeRes();
    const { res: res2, status: statusTwo } = makeRes();

    await Promise.all([secureActionHandler(req1, res1), secureActionHandler(req2, res2)]);

    const statusValues = [
      statusOne.mock.calls.at(-1)?.[0],
      statusTwo.mock.calls.at(-1)?.[0],
    ].filter((value): value is number => typeof value === 'number');
    expect(statusValues.sort()).toEqual([200, 409]);
    const metricCalls = vi
      .mocked(emitSecurityMetric)
      .mock.calls.filter(([payload]) => payload?.name === 'rate_token_reuse');
    expect(metricCalls.length).toBe(1);
  });

  it('falls back to request id when jti header is absent and resolves header arrays', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/secure-action',
    });
    req.get = (() => undefined) as typeof req.get;
    req.headers['x-request-id'] = ['', 'req-fallback'];
    req.headers['x-device-id'] = ['', 'device-from-array'];
    req.headers['x-tenant-id'] = 'tenant-from-string';
    req.headers['user-agent'] = 'agent-from-string';

    const { res, status, type, json } = makeRes();

    await secureActionHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(type).toHaveBeenCalledWith('application/json');
    expect(json).toHaveBeenCalledWith(SECURE_ACTION_OK_RESPONSE);

    const payload = vi.mocked(auditEvent).mock.calls[0]?.[0];
    expect(payload?.meta?.jti).toBe('req-fallback');
    expect(payload?.meta?.correlationId).toBe('req-fallback');
    expect(payload?.meta?.deviceId).toBe('device-from-array');
    expect(payload?.meta?.tenantId).toBe('tenant-from-string');
    expect(payload?.meta?.userAgent).toBe('agent-from-string');
    expect(payload?.meta?.ip).toBe('unknown-ip');
    expect(emitSecurityMetric).not.toHaveBeenCalled();
  });
});
