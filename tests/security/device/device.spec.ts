import { expect } from "vitest";
import { verifyDeviceProof } from "../../../apps/api/src/mw/device-proof";

test("missing proof → 401", async () => {
  const request = new Request("http://localhost:4010/rewards/redeem", { method: "POST", headers: {} });
  await expect(
    verifyDeviceProof(
      { request, devicePublicKey: "PUBKEY", jti: "jti-1" },
      async () => {
        /* no-op */
      },
    ),
  ).rejects.toBeTruthy();
});
