import { expect, test, vi, beforeEach } from "vitest";

const setMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_: unknown) {
      void _;
    }
    set = setMock;
  },
}));

import { RedisReplayStore } from "./redisStore";

beforeEach(() => {
  setMock.mockReset();
});

test("returns true when Redis reports OK", async () => {
  setMock.mockResolvedValueOnce("OK");
  const store = new RedisReplayStore("https://dummy", "token");
  await expect(store.firstUse("jti-1", 60)).resolves.toBe(true);
  expect(setMock).toHaveBeenCalledWith("replay:jti-1", "1", { ex: 60, nx: true });
});

test("returns false when Redis rejects NX constraint", async () => {
  setMock.mockResolvedValueOnce(null);
  const store = new RedisReplayStore("https://dummy", "token");
  await expect(store.firstUse("jti-1", 60)).resolves.toBe(false);
  expect(setMock).toHaveBeenCalledWith("replay:jti-1", "1", { ex: 60, nx: true });
});

test("true once within TTL and false on immediate reuse", async () => {
  setMock.mockResolvedValueOnce("OK");
  setMock.mockResolvedValueOnce(null);
  const store = new RedisReplayStore("https://dummy", "token");
  expect(await store.firstUse("jti-2", 60)).toBe(true);
  expect(await store.firstUse("jti-2", 60)).toBe(false);
});

test("allows reuse after TTL expires (simuliert)", async () => {
  setMock.mockResolvedValueOnce("OK");
  setMock.mockResolvedValueOnce("OK");
  const store = new RedisReplayStore("https://dummy", "token");
  expect(await store.firstUse("jti-3", 1)).toBe(true);
  expect(await store.firstUse("jti-3", 1)).toBe(true);
});
