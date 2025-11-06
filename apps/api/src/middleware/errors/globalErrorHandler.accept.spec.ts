import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { makeRequest } from '../../test-utils/http.js';
import { globalErrorHandler } from './globalErrorHandler.js';

describe('globalErrorHandler content negotiation', () => {
  it('serialises string errors and honours */* Accept header', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const status = vi.fn().mockReturnThis();
    const type = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();

    const req = makeRequest({
      method: 'PUT',
      path: '/accept',
      headers: {
        Accept: '*/*',
      },
    });
    (req as { id?: string }).id = 'req-accept';

    globalErrorHandler(
      'string-error',
      req,
      { status, type, json } as unknown as Response,
      (() => undefined) as NextFunction,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      '[unhandled-error]',
      expect.objectContaining({ correlationId: 'req-accept', error: 'string-error' }),
    );
    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: 'req-accept',
        requestId: 'req-accept',
        error_code: 'INTERNAL_SERVER_ERROR',
      }),
    );

    consoleSpy.mockRestore();
  });
});
