// apps/api/src/mw/rate-limit.ts
import { RATE_LIMIT_WINDOW_SECONDS, globalRateLimits, routeRateLimits } from "../config/rate-limits.v1.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";

export interface RateLimitHit {
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  dimension: "tenant" | "ip_anonymous" | "card" | "device";
  routeId: string;
}

export interface RateLimitStore {
  /**
   * Erhöht Zähler für einen Key im aktuellen Fenster.
   * Liefert die aktuelle Anzahl und TTL in Sekunden zurück.
   */
  incr(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
}

/**
 * Einfache In-Memory-Implementierung nur für Dev/Tests.
 * Prod sollte eine Redis-basierte Implementierung liefern.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly data = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  incr(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    const now = Date.now();
    const existing = this.data.get(key);

    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.data.set(key, { count: 1, expiresAt });
      return Promise.resolve({ count: 1, ttlSeconds: windowSeconds });
    }

    existing.count += 1;
    const ttlMs = existing.expiresAt - now;
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    return Promise.resolve({ count: existing.count, ttlSeconds });
  }
}

export interface RateLimitContextInput {
  routeId: string;
  tenantId?: string;
  cardId?: string;
  deviceId?: string;
  ip?: string | null;
}

/**
 * Berechnet RateLimit-Hits für alle relevanten Dimensionen.
 * Die eigentliche HTTP-Reaktion übernimmt die Middleware-Schicht.
 */
export async function evaluateRateLimits(
  store: RateLimitStore,
  ctx: RateLimitContextInput
): Promise<RateLimitHit | null> {
  const { routeId, tenantId, cardId, deviceId, ip } = ctx;

  // 1) Tenant-Level
  if (tenantId) {
    const key = `rl:tenant:${tenantId}`;
    const { count, ttlSeconds } = await store.incr(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > globalRateLimits.tenantRpm) {
      return {
        dimension: "tenant",
        limit: globalRateLimits.tenantRpm,
        remaining: Math.max(0, globalRateLimits.tenantRpm - count),
        retryAfterSeconds: ttlSeconds,
        routeId,
      };
    }
  }

  // 2) IP anonym
  if (!tenantId && ip) {
    const key = `rl:ip:${hashIp(ip)}`;
    const { count, ttlSeconds } = await store.incr(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > globalRateLimits.ipAnonRpm) {
      return {
        dimension: "ip_anonymous",
        limit: globalRateLimits.ipAnonRpm,
        remaining: Math.max(0, globalRateLimits.ipAnonRpm - count),
        retryAfterSeconds: ttlSeconds,
        routeId,
      };
    }
  }

  // 3) Route-spezifische Limits
  const routeConfig = routeRateLimits[routeId as keyof typeof routeRateLimits];

  if (routeConfig && "cardRpm" in routeConfig && cardId) {
    const key = `rl:card:${routeId}:${cardId}`;
    const { count, ttlSeconds } = await store.incr(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > routeConfig.cardRpm) {
      return {
        dimension: "card",
        limit: routeConfig.cardRpm,
        remaining: Math.max(0, routeConfig.cardRpm - count),
        retryAfterSeconds: ttlSeconds,
        routeId,
      };
    }
  }

  if (routeConfig && "deviceRpm" in routeConfig && deviceId) {
    const key = `rl:device:${routeId}:${deviceId}`;
    const { count, ttlSeconds } = await store.incr(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > routeConfig.deviceRpm) {
      return {
        dimension: "device",
        limit: routeConfig.deviceRpm,
        remaining: Math.max(0, routeConfig.deviceRpm - count),
        retryAfterSeconds: ttlSeconds,
        routeId,
      };
    }
  }

  return null;
}

/**
 * IP-Hash, um PII zu vermeiden.
 * IP darf nicht im Klartext geloggt werden (AGENTS).
 */
function hashIp(ip: string): string {
  // sehr simple Pseudohash-Funktion für Demo-Zwecke
  // für Prod lieber einen stabilen, nicht rückrechenbaren Hash nutzen
  return createHash("sha256").update(ip, "utf8").digest("hex");
}

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
  retry_after?: number;
};

type RateLimitRequest = IncomingMessage & {
  context?: {
    admin?: { tenantId: string };
    device?: { tenantId: string; deviceId: string };
    card?: { cardId: string };
    correlation_id?: string;
  };
  route?: { path?: string };
  path?: string;
};

function problem(
  status: number,
  title: string,
  detail: string,
  instance: string,
  error_code?: string,
  retryAfter?: number,
  correlationId?: string
): ProblemDetails {
  return {
    type: "https://errors.lokaltreu.example/rate/limited",
    title,
    status,
    detail,
    instance,
    error_code,
    correlation_id: correlationId ?? randomUUID(),
    retry_after: retryAfter,
  };
}

function sendProblem(res: ServerResponse, payload: ProblemDetails) {
  res.statusCode = payload.status;
  res.setHeader("Content-Type", "application/problem+json");
  if (typeof payload.retry_after === "number") {
    res.setHeader("Retry-After", payload.retry_after.toString());
  }
  res.end(JSON.stringify(payload));
}

function getRouteId(req: RateLimitRequest): string {
  const method = req.method ?? "GET";
  const path = req.route?.path ?? req.path ?? req.url?.split("?")[0] ?? "/";
  return `${method} ${path}`;
}

function getTenantId(req: RateLimitRequest): string | undefined {
  return (
    req.context?.admin?.tenantId ??
    req.context?.device?.tenantId ??
    // Header-Fallback nur für Tests/interne Calls (keine produktive API-Änderung)
    (typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : undefined)
  );
}

function getDeviceId(req: RateLimitRequest): string | undefined {
  return (
    req.context?.device?.deviceId ??
    // Header-Fallback nur für Tests/interne Calls (keine produktive API-Änderung)
    (typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : undefined)
  );
}

function getCardId(req: RateLimitRequest): string | undefined {
  return (
    req.context?.card?.cardId ??
    // Header-Fallback nur für Tests/interne Calls (keine produktive API-Änderung)
    (typeof req.headers["x-card-id"] === "string" ? req.headers["x-card-id"] : undefined)
  );
}

function getIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.socket.remoteAddress ?? null;
}

function getLimitDetail(hit: RateLimitHit): string {
  switch (hit.dimension) {
    case "tenant":
      return "Rate limit exceeded for tenant";
    case "device":
      return "Rate limit exceeded for device";
    case "card":
      return "Rate limit exceeded for card";
    case "ip_anonymous":
      return "Rate limit exceeded for IP";
    default:
      return "Rate limit exceeded";
  }
}

export function createRateLimitMiddleware(store: RateLimitStore) {
  return async function requireRateLimit(req: RateLimitRequest, res: ServerResponse): Promise<boolean> {
    const routeId = getRouteId(req);
    const tenantId = getTenantId(req);
    const cardId = getCardId(req);
    const deviceId = getDeviceId(req);
    const ip = getIp(req);

    const hit = await evaluateRateLimits(store, {
      routeId,
      tenantId,
      cardId,
      deviceId,
      ip,
    });

    if (!hit) {
      return true;
    }

    const status = 429;
    const correlationId = req.context?.correlation_id ?? randomUUID();

    console.warn({
      event: "rate_limit",
      dimension: hit.dimension,
      routeId,
      retry_after: hit.retryAfterSeconds,
      tenant_id: tenantId,
      device_id: deviceId,
      card_id: cardId,
      correlation_id: correlationId,
    });

    const detail = getLimitDetail(hit);
    const payload = problem(
      status,
      "Rate limited",
      detail,
      req.url ?? "/",
      "RATE_LIMITED",
      hit.retryAfterSeconds,
      correlationId
    );

    sendProblem(res, payload);
    return false;
  };
}
