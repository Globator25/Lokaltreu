import { test, expect } from "vitest";
import { verifyDeviceProof } from "../../../apps/api/src/mw/device-proof";
const BASE = process.env.API_BASE ?? "http://localhost:3001";

test("missing proof → 401", async () => {
  const req = new Request(`${BASE}/rewards/redeem`, { method: "POST", headers: {} });
  await expect(verifyDeviceProof(req)).rejects.toThrow(/401|UNAUTHORIZED/i);
});
