import { createRedisClient } from "../../infra/redisClient.js";
import type { IdempotencyStore, StoredResult } from "../../mw/idempotency.js";

const RESULT_PREFIX = "idem:result:";
const LOCK_PREFIX = "idem:lock:";

function resultKey(key: string) {
  return `${RESULT_PREFIX}${key}`;
}

function lockKey(key: string) {
  return `${LOCK_PREFIX}${key}`;
}

function isStoredResult(value: unknown): value is StoredResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.status !== "number") return false;
  if (typeof record.body !== "string") return false;
  if (!record.headers || typeof record.headers !== "object") return false;
  return true;
}

export function createRedisIdempotencyStore(): IdempotencyStore {
  const client = createRedisClient();

  return {
    async getResult(key: string): Promise<StoredResult | null> {
      const raw = await client.get(resultKey(key));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isStoredResult(parsed) ? parsed : null;
    },

    async setResult(key: string, value: StoredResult, ttlSeconds: number): Promise<void> {
      const payload = JSON.stringify(value);
      await client.set(resultKey(key), payload, { ex: ttlSeconds });
    },

    async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
      const result = await client.set(lockKey(key), "1", { nx: true, ex: ttlSeconds });
      return result === "OK";
    },

    async releaseLock(key: string): Promise<void> {
      await client.del(lockKey(key));
    },
  };
}
