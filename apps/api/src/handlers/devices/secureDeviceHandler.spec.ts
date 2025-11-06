import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { SECURE_DEVICE_OK_RESPONSE } from '../../runtime/contracts.js';
import { makeRequest } from '../../test-utils/http.js';
import { secureDeviceHandler } from './secureDeviceHandler.js';

vi.mock('../../audit/auditEvent.js', () => ({
  auditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../security/device/verifyDeviceProof.js', () => ({
  verifyDeviceProof: vi.fn(),
  rejectDeviceProof: vi.fn(),
}));

import { auditEvent } from '../../audit/auditEvent.js';
import { rejectDeviceProof, verifyDeviceProof } from '../../security/device/verifyDeviceProof.js';

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

describe('secureDeviceHandler', () => {
  beforeEach(() => {
    vi.mocked(auditEvent).mockClear();
    vi.mocked(verifyDeviceProof).mockReset();
    vi.mocked(rejectDeviceProof).mockReset();
  });

  it('responds with 200 and audit ok when device proof succeeds', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/secure-device',
      ip: '10.0.0.1',
      headers: {
        'x-request-id': 'req-200',
        'x-device-id': 'device-200',
        'x-device-jti': 'jti-200',
        'x-tenant-id': 'tenant-200',
        'user-agent': 'vitest-device-agent',
      },
    });
    const { res, status, type, json } = makeRes();

    vi.mocked(verifyDeviceProof).mockResolvedValue({
      ok: true,
      deviceId: 'device-200',
    });

    await secureDeviceHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(type).toHaveBeenCalledWith('application/json');
    expect(json).toHaveBeenCalledWith(SECURE_DEVICE_OK_RESPONSE);
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'secure_device.ok',
        meta: expect.objectContaining({
          result: 'ok',
          action: 'secure_device',
          ip: '10.0.0.1',
          jti: 'jti-200',
          tenantId: 'tenant-200',
        }),
      }),
    );
    expect(rejectDeviceProof).not.toHaveBeenCalled();
  });

  it('delegates to rejectDeviceProof when validation fails', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/secure-device',
      ip: '10.0.0.2',
      headers: {
        'x-request-id': 'req-403',
        'x-device-id': 'device-403',
        'x-device-jti': 'jti-403',
        'x-tenant-id': 'tenant-403',
        'user-agent': 'vitest-device-agent',
      },
    });
    const { res } = makeRes();
    vi.mocked(verifyDeviceProof).mockResolvedValue({
      ok: false,
      reason: 'TIMESTAMP_OUTSIDE_ALLOWED_WINDOW',
      deviceId: 'device-403',
    });

    await secureDeviceHandler(req, res);

    expect(rejectDeviceProof).toHaveBeenCalledWith(
      res,
      'TIMESTAMP_OUTSIDE_ALLOWED_WINDOW',
      'jti-403',
    );
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'secure_device.proof_failed',
        meta: expect.objectContaining({
          result: 'failed',
          ip: '10.0.0.2',
          jti: 'jti-403',
          tenantId: 'tenant-403',
        }),
      }),
    );
  });

  it('derives audit metadata from raw headers when device id is missing in proof result', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/secure-device',
    });
    req.get = (() => undefined) as typeof req.get;
    req.headers['x-request-id'] = ['', 'req-array'];
    req.headers['x-tenant-id'] = 'tenant-from-header';
    req.headers['x-device-id'] = ['', 'device-from-array'];
    req.headers['x-device-jti'] = ['', 'jti-from-array'];
    req.headers['user-agent'] = '   ';

    const { res, status, type, json } = makeRes();

    vi.mocked(verifyDeviceProof).mockResolvedValue({
      ok: true,
      deviceId: undefined,
    });

    await secureDeviceHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(type).toHaveBeenCalledWith('application/json');
    expect(json).toHaveBeenCalledWith(SECURE_DEVICE_OK_RESPONSE);

    const payload = vi.mocked(auditEvent).mock.calls[0]?.[0];
    expect(payload?.requestId).toBe('req-array');
    expect(payload?.meta?.tenantId).toBe('tenant-from-header');
    expect(payload?.meta?.deviceId).toBe('device-from-array');
    expect(payload?.meta?.jti).toBe('jti-from-array');
    expect(payload?.meta?.userAgent).toBe('unknown-ua');
    expect(payload?.meta?.ip).toBe('unknown-ip');
    expect(payload?.meta?.correlationId).toBe('jti-from-array');
    expect(rejectDeviceProof).not.toHaveBeenCalled();
  });
});
