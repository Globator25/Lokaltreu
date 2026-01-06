import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StoredResult } from "../../mw/idempotency.js";

const getMock = vi.fn();
const setMock = vi.fn();
const delMock = vi.fn();

vi.mock("../../infra/redisClient.js", () => ({
  createRedisClient: vi.fn(() => ({
    get: getMock,
    set: setMock,
    del: delMock,
  })),
}));

import { createRedisIdempotencyStore } from "./redis.js";

describe("createRedisIdempotencyStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no stored result exists", async () => {
    getMock.mockResolvedValueOnce(null);
    const store = createRedisIdempotencyStore();
    await expect(store.getResult("key-1")).resolves.toBeNull();
    expect(getMock).toHaveBeenCalledWith("idem:result:key-1");
  });

  it("returns stored result when JSON is valid", async () => {
    const stored: StoredResult = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: "{\"ok\":true}",
    };
    getMock.mockResolvedValueOnce(JSON.stringify(stored));
    const store = createRedisIdempotencyStore();
    await expect(store.getResult("key-2")).resolves.toEqual(stored);
  });

  it("returns null when stored JSON is invalid", async () => {
    getMock.mockResolvedValueOnce(JSON.stringify({ status: "bad" }));
    const store = createRedisIdempotencyStore();
    await expect(store.getResult("key-3")).resolves.toBeNull();
  });

  it("stores result with TTL", async () => {
    const store = createRedisIdempotencyStore();
    const result: StoredResult = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: "{\"ok\":true}",
    };
    await store.setResult("key-4", result, 60);
    expect(setMock).toHaveBeenCalledWith("idem:result:key-4", JSON.stringify(result), { ex: 60 });
  });

  it("acquires and releases locks", async () => {
    setMock.mockResolvedValueOnce("OK");
    const store = createRedisIdempotencyStore();
    await expect(store.acquireLock("key-5", 30)).resolves.toBe(true);
    expect(setMock).toHaveBeenCalledWith("idem:lock:key-5", "1", { nx: true, ex: 30 });

    await store.releaseLock("key-5");
    expect(delMock).toHaveBeenCalledWith("idem:lock:key-5");
  });

  it("returns false when lock already exists", async () => {
    setMock.mockResolvedValueOnce(null);
    const store = createRedisIdempotencyStore();
    await expect(store.acquireLock("key-6", 30)).resolves.toBe(false);
  });
});
