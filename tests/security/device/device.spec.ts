import { test, expect } from "vitest";
const BASE = process.env.API_BASE ?? "http://localhost:3001";

test("missing proof → 401", async () => {
  const r = await fetch(`${BASE}/rewards/redeem`, { method: "POST" });
  expect(r.status).toBe(401);
  const p = await r.json();
  expect((p?.type ?? "").toUpperCase()).toContain("UNAUTHORIZED");
});
