import { describe, it,expect, test } from 'vitest';
import { health } from './index';
describe('api health', () => { it('ok', () => expect(health()).toBe('ok')); });

test('should pass', () => {
  expect(true).toBe(true);
});