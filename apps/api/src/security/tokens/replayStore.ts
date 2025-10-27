// Umschalten per process.env.REDIS_URL / REDIS_TOKEN.
// SPEC: Produktion MUSS Redis benutzen.
// Dev: InMemory erlaubt lokale Iteration ohne Upstash.

import { InMemoryReplayStore, RedisReplayStore, ReplayStore } from "./redisStore";

let instance: ReplayStore | null = null;

export function getReplayStore(): ReplayStore {
  if (instance) {
    return instance;
  }

  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;

  if (redisUrl && redisToken) {
    // Produktionspfad. Upstash Redis EU.
    // SPEC: Produktion MUSS Redis SETNX(jti)+TTL=60s nutzen.
    instance = new RedisReplayStore(redisUrl, redisToken);
  } else {
    // Lokaler Fallback blockiert Entwickler-Workflow nicht.
    instance = new InMemoryReplayStore();
  }

  return instance;
}

// Nur fuer Tests: Reset zwischen Testfaellen erlaubt es, unterschiedliche Stores zu initialisieren.
export function resetReplayStoreForTests(): void {
  instance = null;
}
