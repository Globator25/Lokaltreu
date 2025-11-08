import { test, expect } from "vitest";
import pLimit from "p-limit";
const BASE = process.env.API_BASE ?? "http://localhost:3001";

test("10 parallel → 1x201, 9x409", async () => {
  const limit = pLimit(10);
  const calls = Array.from({ length: 10 }, () =>
    limit(async () => {
      const r = await fetch(`${BASE}/stamps/claim`, {
        method: "POST",
        headers: {
          "Idempotency-Key": "SAME",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      return r.status;
    })
  );
  const statuses = await Promise.all(calls);
  expect(statuses.filter((s) => s === 201).length).toBe(1);
  expect(statuses.filter((s) => s === 409).length).toBe(9);
});
