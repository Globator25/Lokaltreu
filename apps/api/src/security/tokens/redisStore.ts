// npm install @upstash/redis
// RedisReplayStore ist die produktive Implementierung.
// Region: Upstash Redis EU.
// SETNX(jti)+TTL=60s ist MUSS laut SPEC Anti-Replay.

import { Redis } from "@upstash/redis";

export interface ReplayStore {
  firstUse(jti: string, ttlSeconds: number): Promise<boolean>;
}

export class RedisReplayStore implements ReplayStore {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async firstUse(jti: string, ttlSeconds: number): Promise<boolean> {
    const created = await this.redis.set(`jti:${jti}`, "1", { nx: true, ex: ttlSeconds });
    return created === "OK";
  }
}

// TODO: Nur fuer lokale Dev-Tests. Nicht in Produktion verwenden.
export class InMemoryReplayStore implements ReplayStore {
  private readonly entries = new Map<string, number>();

  async firstUse(jti: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();

    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(key);
      }
    }

    const existingExpiry = this.entries.get(jti);
    if (existingExpiry && existingExpiry > now) {
      return false;
    }

    this.entries.set(jti, now + ttlSeconds * 1000);
    return true;
  }
}

// Hinweis: Produktion MUSS RedisReplayStore (Upstash EU) nutzen. InMemoryReplayStore ist nur Dev-Fallback.
