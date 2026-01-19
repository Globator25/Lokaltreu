import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanUsageTracker } from "./plan-policy.js";
import { InMemoryPlanWarningDedupStore } from "./plan-dedup-store.js";

describe("createPlanUsageTracker", () => {
  const originalStarterLimit = process.env.PLAN_LIMIT_STAMPS_STARTER;

  afterEach(() => {
    process.env.PLAN_LIMIT_STAMPS_STARTER = originalStarterLimit;
    vi.useRealTimers();
  });

  it("dedupes plan warning within 24 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    process.env.PLAN_LIMIT_STAMPS_STARTER = "1";

    const planStore = {
      getPlan: async () => "starter" as const,
    };
    const warningDedupStore = new InMemoryPlanWarningDedupStore(() => Date.now());
    const tracker = createPlanUsageTracker({
      planStore,
      warningDedupStore,
      now: () => new Date(),
    });

    const first = await tracker.recordStamp({
      tenantId: "tenant-1",
      plan: "starter",
      correlationId: "corr-1",
    });
    expect(first?.threshold).toBe(100);
    expect(first?.shouldNotify).toBe(true);

    const second = await tracker.recordStamp({
      tenantId: "tenant-1",
      plan: "starter",
      correlationId: "corr-2",
    });
    expect(second?.threshold).toBe(100);
    expect(second?.shouldNotify).toBe(false);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    const third = await tracker.recordStamp({
      tenantId: "tenant-1",
      plan: "starter",
      correlationId: "corr-3",
    });
    expect(third?.threshold).toBe(100);
    expect(third?.shouldNotify).toBe(true);
  });
});
