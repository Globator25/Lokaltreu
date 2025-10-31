import { expect } from 'vitest';
import pLimit from 'p-limit';
test('10 parallel → 1x201, 9x409', async () => {
  const limit = pLimit(10);
  const calls = Array.from({length:10},()=>limit(async()=>{
    const r = await fetch('http://localhost:4010/stamps/claim',{method:'POST',headers:{'Idempotency-Key':'SAME'},body:JSON.stringify({qrToken:'X'})});
    return r.status;
  }));
  const statuses = await Promise.all(calls);
  expect(statuses.filter(s=>s===201).length).toBe(1);
  expect(statuses.filter(s=>s===409).length).toBe(9);
});
