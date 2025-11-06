import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { makeRequest } from '../../test-utils/http.js';
import { globalErrorHandler } from './globalErrorHandler.js';

describe('globalErrorHandler edge cases', () => {
  it('falls back to req.id when correlation header is missing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const status = vi.fn().mockReturnThis();
    const type = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();

    const req = makeRequest({
      method: 'GET',
      path: '/fallback',
    });
    (req as { id?: string }).id = 'req-from-context';

    globalErrorHandler(
      new Error('fallback'),
      req,
      { status, type, json } as unknown as Response,
      (() => undefined) as NextFunction,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      '[unhandled-error]',
      expect.objectContaining({ correlationId: 'req-from-context' }),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: 'req-from-context',
        requestId: 'req-from-context',
      }),
    );
    consoleSpy.mockRestore();
  });

  it('uses the first non-empty entry from array headers', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const status = vi.fn().mockReturnThis();
    const type = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();

    const req = makeRequest({
      method: 'POST',
      path: '/array-header',
    });
    req.get = (() => undefined) as typeof req.get;
    req.headers['x-request-id'] = ['', 'first-array-entry'];
    req.headers['x-correlation-id'] = ['', 'corr-array'];

    globalErrorHandler(
      new Error('array-error'),
      req,
      { status, type, json } as unknown as Response,
      (() => undefined) as NextFunction,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      '[unhandled-error]',
      expect.objectContaining({ correlationId: 'corr-array' }),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ correlation_id: 'corr-array', requestId: 'first-array-entry' }),
    );
    consoleSpy.mockRestore();
  });
});
