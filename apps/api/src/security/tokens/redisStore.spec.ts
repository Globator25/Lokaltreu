import { beforeEach, describe, expect, it, vi } from "vitest";

const setMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: setMock,
  })),
}));

import { InMemoryReplayStore, RedisReplayStore } from "./redisStore.js";

describe("InMemoryReplayStore", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns true once within TTL and false on immediate reuse", async () => {
    const store = new InMemoryReplayStore();
    const first = await store.firstUse("memo", 60);
    const second = await store.firstUse("memo", 60);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("allows reuse after TTL expires", async () => {
    vi.useFakeTimers();
    const store = new InMemoryReplayStore();

    const first = await store.firstUse("ttl", 1);
    vi.advanceTimersByTime(1_001);
    const second = await store.firstUse("ttl", 1);

    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});

describe("RedisReplayStore", () => {
  beforeEach(() => {
    setMock.mockReset();
  });

  it("returns true when Redis reports OK", async () => {
    setMock.mockResolvedValueOnce("OK");
    const store = new RedisReplayStore("https://redis", "token");
    const first = await store.firstUse("redis-ok", 60);

    expect(first).toBe(true);
    expect(setMock).toHaveBeenCalledWith("jti:redis-ok", "1", { nx: true, ex: 60 });
  });

  it("returns false when Redis rejects NX constraint", async () => {
    setMock.mockResolvedValueOnce(null);
    const store = new RedisReplayStore("https://redis", "token");
    const reused = await store.firstUse("redis-reuse", 60);

    expect(reused).toBe(false);
  });
});
