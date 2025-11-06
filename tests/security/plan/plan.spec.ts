import { expect } from 'vitest';
test('Starter → 403 PLAN_NOT_ALLOWED', async () => {
  const r = await fetch('http://localhost:4010/referrals/link');
  expect(r.status).toBe(403);
  const p = await r.json();
  expect(p.error_code).toBe('PLAN_NOT_ALLOWED');
});
