import { describe, it, expect, vi, beforeEach } from "vitest";

const setMock = vi.fn();

vi.mock("@upstash/redis", () => {
  class MockRedis {
    constructor(config: { url: string; token: string }) {
      void config;
    }
    async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
      return setMock(key, value, opts);
    }
  }
  return { Redis: MockRedis, default: MockRedis };
});

import { RedisReplayStore } from "./redisStore";

beforeEach(() => {
  vi.resetModules();
  setMock.mockReset();
});

describe("RedisReplayStore", () => {
  it("returns true when Redis reports OK", async () => {
    setMock.mockResolvedValueOnce("OK");
    const store = new RedisReplayStore("https://dummy", "token");
    await expect(store.firstUse("jti-1", 60)).resolves.toBe(true);
    expect(setMock).toHaveBeenCalledWith("replay:jti-1", "1", { ex: 60, nx: true });
  });

  it("returns false when Redis rejects NX constraint", async () => {
    setMock.mockResolvedValueOnce(null);
    const store = new RedisReplayStore("https://dummy", "token");
    await expect(store.firstUse("jti-1", 60)).resolves.toBe(false);
    expect(setMock).toHaveBeenCalledWith("replay:jti-1", "1", { ex: 60, nx: true });
  });

  it("true once within TTL and false on immediate reuse", async () => {
    setMock.mockResolvedValueOnce("OK");
    setMock.mockResolvedValueOnce(null);
    const store = new RedisReplayStore("https://dummy", "token");
    expect(await store.firstUse("jti-2", 60)).toBe(true);
    expect(await store.firstUse("jti-2", 60)).toBe(false);
  });

  it("allows reuse after TTL expires (simuliert)", async () => {
    setMock.mockResolvedValueOnce("OK");
    setMock.mockResolvedValueOnce("OK");
    const store = new RedisReplayStore("https://dummy", "token");
    expect(await store.firstUse("jti-3", 1)).toBe(true);
    expect(await store.firstUse("jti-3", 1)).toBe(true);
  });
});
