import { test, expect } from "vitest";
const BASE = process.env.API_BASE ?? "http://localhost:3001";

test("Starter → 403 PLAN_NOT_ALLOWED", async () => {
  const r = await fetch(`${BASE}/referrals/link`);
  expect(r.status).toBe(403);
  const p = await r.json();
  expect(p?.type ?? "").toContain("PLAN_NOT_ALLOWED");
});
