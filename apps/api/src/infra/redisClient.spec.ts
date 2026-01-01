import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const getMock = vi.fn();
const setMock = vi.fn();
const delMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: getMock,
    set: setMock,
    del: delMock,
  })),
}));

import { createRedisClient } from "./redisClient.js";

describe("createRedisClient", () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_IDEM_URL = "https://redis.example";
    process.env.REDIS_IDEM_TOKEN = "token";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("throws when required env vars are missing", () => {
    delete process.env.REDIS_IDEM_URL;
    delete process.env.REDIS_IDEM_TOKEN;
    expect(() => createRedisClient()).toThrow("Missing REDIS_IDEM_URL/REDIS_IDEM_TOKEN env vars");
  });

  it("passes through get and del", async () => {
    getMock.mockResolvedValueOnce("value");
    delMock.mockResolvedValueOnce(1);

    const client = createRedisClient();
    await expect(client.get("key")).resolves.toBe("value");
    await expect(client.del("key")).resolves.toBe(1);
    expect(getMock).toHaveBeenCalledWith("key");
    expect(delMock).toHaveBeenCalledWith("key");
  });

  it("sets without options by default", async () => {
    setMock.mockResolvedValueOnce("OK");
    const client = createRedisClient();
    await client.set("key", "value");
    expect(setMock).toHaveBeenCalledWith("key", "value");
  });

  it("sets with nx and ex", async () => {
    setMock.mockResolvedValueOnce("OK");
    const client = createRedisClient();
    await client.set("key", "value", { nx: true, ex: 10 });
    expect(setMock).toHaveBeenCalledWith("key", "value", { nx: true, ex: 10 });
  });

  it("sets with nx only", async () => {
    setMock.mockResolvedValueOnce("OK");
    const client = createRedisClient();
    await client.set("key", "value", { nx: true });
    expect(setMock).toHaveBeenCalledWith("key", "value", { nx: true });
  });

  it("sets with ex only", async () => {
    setMock.mockResolvedValueOnce("OK");
    const client = createRedisClient();
    await client.set("key", "value", { ex: 5 });
    expect(setMock).toHaveBeenCalledWith("key", "value", { ex: 5 });
  });
});
