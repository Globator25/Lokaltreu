import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReplayStore, resetReplayStoreForTests } from "./replayStore.js";
import { InMemoryReplayStore, RedisReplayStore } from "./redisStore.js";

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_opts: unknown) {
      void _opts;
    }
    set(): void {
      // no-op for tests
    }
  },
}));

const originalReplayStore = process.env.REPLAY_STORE;
const originalRedisUrl = process.env.REDIS_URL;
const originalRedisToken = process.env.REDIS_TOKEN;

describe("getReplayStore", () => {
  beforeEach(() => {
    resetReplayStoreForTests();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    delete process.env.REPLAY_STORE;
  });

  afterEach(() => {
    resetReplayStoreForTests();
    process.env.REPLAY_STORE = originalReplayStore;
    process.env.REDIS_URL = originalRedisUrl;
    process.env.REDIS_TOKEN = originalRedisToken;
  });

  it("returns in-memory implementation when REPLAY_STORE=memory", () => {
    process.env.REPLAY_STORE = "memory";
    const store = getReplayStore();
    expect(store).toBeInstanceOf(InMemoryReplayStore);
  });

  it("throws when REPLAY_STORE=redis is configured without credentials", () => {
    process.env.REPLAY_STORE = "redis";
    expect(() => getReplayStore()).toThrow(/REPLAY_STORE=redis/);
  });

  it("defaults to Redis when credentials are present", () => {
    process.env.REDIS_URL = "https://example.upstash.io";
    process.env.REDIS_TOKEN = "token";
    const store = getReplayStore();
    expect(store).toBeInstanceOf(RedisReplayStore);
  });
});
