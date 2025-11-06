import { describe, expect, it } from 'vitest';
import { asProblem, problem } from './problem.js';

describe('problem helper', () => {
  it('creates a problem with all fields from an object', () => {
    try {
      problem({
        type: 'https://errors.lokaltreu.example/demo',
        title: 'DEMO',
        status: 422,
        detail: 'Invalid demo payload',
        error_code: 'DEMO_INVALID',
      });
      throw new Error('expected problem() to throw');
    } catch (error) {
      const cause = (error as Error & { cause?: Record<string, unknown> }).cause;
      expect(cause).toMatchObject({
        status: 422,
        title: 'DEMO',
        type: 'https://errors.lokaltreu.example/demo',
        detail: 'Invalid demo payload',
        error_code: 'DEMO_INVALID',
      });
    }
  });

  it('serializes non-error inputs defensively', () => {
    try {
      problem('not-an-object');
      throw new Error('expected problem() to throw');
    } catch (error) {
      const cause = (error as Error & { cause?: Record<string, unknown> }).cause;
      expect(cause).toMatchObject({
        status: 500,
        error_code: 'UNKNOWN',
      });
    }
  });
});

describe('asProblem', () => {
  it('fills default type and title when missing', () => {
    const value = asProblem({ status: 404, detail: 'missing' });
    expect(value.type).toBe('about:blank');
    expect(value.title).toBe('Problem');
    expect(value.status).toBe(404);
    expect(value.detail).toBe('missing');
  });
});
