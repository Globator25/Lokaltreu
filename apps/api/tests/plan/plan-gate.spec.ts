import { describe, expect, it } from "vitest";
import { requirePlan } from "../../src/mw/plan-gate.js";

describe("requirePlan('referral')", () => {
  it("rejects Starter tenants with PLAN_NOT_ALLOWED problem", async () => {
    const guard = requirePlan("referral");
    await expect(guard("Starter")).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 403,
        error_code: "PLAN_NOT_ALLOWED",
        type: "https://errors.lokaltreu.example/plan/not-allowed",
      }),
    });
  });

  it("allows Plus tenants to proceed", async () => {
    const guard = requirePlan("referral");
    await expect(guard("Plus")).resolves.toBeUndefined();
  });

  it("allows Premium tenants to proceed", async () => {
    const guard = requirePlan("referral");
    await expect(guard("Premium")).resolves.toBeUndefined();
  });
});
