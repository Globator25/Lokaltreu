import { Redis } from "@upstash/redis";

// Minimal set options: we only need EX/NX for locks and TTLs.
export type RedisSetOptions = {
  ex?: number;
  nx?: boolean;
};

type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: RedisSetOptions) => Promise<string | null>;
  del: (key: string) => Promise<number>;
};

export function createRedisClient(): RedisClient {
  const url = process.env.REDIS_IDEM_URL;
  const token = process.env.REDIS_IDEM_TOKEN;
  if (!url || !token) {
    throw new Error("Missing REDIS_IDEM_URL/REDIS_IDEM_TOKEN env vars");
  }
  const client = new Redis({ url, token });
  return {
    get: (key) => client.get(key),
    set: (key, value, opts) => {
      if (!opts) {
        return client.set(key, value);
      }
      if (opts.nx && typeof opts.ex === "number") {
        return client.set(key, value, { nx: true, ex: opts.ex });
      }
      if (opts.nx) {
        return client.set(key, value, { nx: true });
      }
      if (typeof opts.ex === "number") {
        return client.set(key, value, { ex: opts.ex });
      }
      return client.set(key, value);
    },
    del: (key) => client.del(key),
  };
}
