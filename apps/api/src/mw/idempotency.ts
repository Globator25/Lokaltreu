import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { problem } from "../lib/problem.js";

type RedisNxClient = {
  set(key: string, value: string, options: { nx: true; ex: number }): Promise<"OK" | string | null>;
};

const TTL_SECONDS = 24 * 60 * 60;
const inMemoryStore = new Map<string, number>();

const fallbackRedis: RedisNxClient = {
  async set(key, _value, options) {
    const now = Date.now();
    const expiresAt = inMemoryStore.get(key);
    if (expiresAt && expiresAt > now) {
      return null;
    }
    inMemoryStore.set(key, now + options.ex * 1000);
    return "OK";
  },
};

let sharedRedis: RedisNxClient | undefined;
const redisUrl = process.env.REDIS_URL;
const redisToken = process.env.REDIS_TOKEN;
if (redisUrl && redisToken) {
  sharedRedis = new Redis({ url: redisUrl, token: redisToken });
}

export interface IdempotencyContext {
  request: Request;
  tenantId: string;
  route: string;
  redis?: RedisNxClient;
  rawBody?: string;
}

export type Next = () => Promise<unknown>;

export async function requireIdempotency(ctx: IdempotencyContext, next: Next): Promise<void> {
  const headerValue = ctx.request.headers.get("Idempotency-Key");
  if (!headerValue || headerValue.trim().length === 0) {
    throw problem({
      type: "https://errors.lokaltreu.example/headers/missing-idempotency",
      title: "Idempotency-Key required",
      status: 400,
      error_code: "HEADERS_MISSING",
      correlation_id: randomUUID(),
      detail: "Provide Idempotency-Key header for all mutating requests.",
    });
  }

  const requestClone = "clone" in ctx.request ? ctx.request.clone() : ctx.request;
  const rawBody =
    ctx.rawBody ??
    (typeof (requestClone as Request).text === "function" ? await (requestClone as Request).text() : "");

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const scope = `${ctx.tenantId}|${ctx.route}|${bodyHash}`;
  const cacheKey = `idempotency:${scope}:${headerValue}`;

  const redisClient = ctx.redis ?? sharedRedis ?? fallbackRedis;
  const result = await redisClient.set(cacheKey, "1", { nx: true, ex: TTL_SECONDS });

  if (result !== "OK") {
    throw problem({
      type: "https://errors.lokaltreu.example/idempotency/replay",
      title: "Duplicate request",
      status: 409,
      error_code: "IDEMPOTENT_REPLAY",
      correlation_id: randomUUID(),
      detail: "Idempotency window is 24h per tenant/route/body hash.",
    });
  }

  await next();
}


