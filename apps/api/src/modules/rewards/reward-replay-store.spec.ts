import { describe, expect, it, vi } from "vitest";
import { InMemoryRewardReplayStore } from "./reward-replay-store.js";

describe("reward replay store", () => {
  it("uses ttlSeconds relative to now", async () => {
    vi.useFakeTimers();
    const store = new InMemoryRewardReplayStore();
    const start = new Date("2025-01-01T00:00:00.000Z");
    vi.setSystemTime(start);

    const first = await store.consume({ tenantId: "tenant-1", jti: "jti-1", ttlSeconds: 5 });
    expect(first).toBe(true);

    vi.setSystemTime(new Date(start.getTime() + 4_000));
    const replayBlocked = await store.consume({ tenantId: "tenant-1", jti: "jti-1", ttlSeconds: 5 });
    expect(replayBlocked).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 6_000));
    const expiredAllowed = await store.consume({ tenantId: "tenant-1", jti: "jti-1", ttlSeconds: 5 });
    expect(expiredAllowed).toBe(true);

    vi.useRealTimers();
  });
});

