import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { makeRequest } from '../../test-utils/http.js';
import { globalErrorHandler } from './globalErrorHandler.js';

describe('globalErrorHandler headersSent handling', () => {
  it('delegates to next when headers have already been sent', () => {
    const error = new Error('already-sent');
    const req = makeRequest({ method: 'POST', path: '/after-send' });
    const res = {
      headersSent: true,
      status: vi.fn(),
      type: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn<Parameters<NextFunction>, ReturnType<NextFunction>>();

    globalErrorHandler(error, req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect((res.status as unknown as vi.Mock).mock.calls.length).toBe(0);
    expect((res.type as unknown as vi.Mock).mock.calls.length).toBe(0);
    expect((res.json as unknown as vi.Mock).mock.calls.length).toBe(0);
  });
});
