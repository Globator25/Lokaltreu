// apps/api/src/config/rate-limits.v1.ts

/**
 * Rate-Limits v1, gemäß SPEC:
 * Tenant 600 rpm; IP anonym 120 rpm; /stamps/claim 30 rpm/Card; /rewards/redeem 10 rpm/Device.
 * Quelle: SPEC Anti-Abuse / Rate-Limits.
 */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export const globalRateLimits = {
  tenantRpm: 600,
  ipAnonRpm: 120,
} as const;

export const routeRateLimits = {
  "POST /stamps/claim": {
    cardRpm: 30,
  },
  "POST /rewards/redeem": {
    deviceRpm: 10,
  },
} as const;

export type RouteId = keyof typeof routeRateLimits;
