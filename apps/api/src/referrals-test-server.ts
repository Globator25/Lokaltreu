import { createServer } from "node:http";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import type { DeviceAuthRequest } from "./middleware/device-auth.js";
import { handleGetReferralLink } from "./handlers/referrals/link.js";
import { handleStampClaim } from "./handlers/stamps/claim.js";
import { handleStampTokens } from "./handlers/stamps/tokens.js";
import { readJsonBody } from "./handlers/http-utils.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "./mw/idempotency.js";
import { createStampService, InMemoryCardStateStore, InMemoryStampTokenStore } from "./modules/stamps/stamp.service.js";
import { InMemoryReferralRepository } from "./repositories/referrals.repo.js";
import { InMemoryTenantPlanStore } from "./services/plan-gate.js";
import { createReferralService } from "./services/referrals.service.js";

export type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  planStore: InMemoryTenantPlanStore;
  auditEvents: string[];
  cardStore: InMemoryCardStateStore;
};

export async function startReferralServer(): Promise<ServerHandle> {
  if (process.env.REFERRAL_LINK_BASE_URL === undefined) {
    process.env.REFERRAL_LINK_BASE_URL = "https://pwa.example/r/";
  }
  const tokenStore = new InMemoryStampTokenStore();
  const cardStore = new InMemoryCardStateStore();
  const referralRepo = new InMemoryReferralRepository();
  const planStore = new InMemoryTenantPlanStore();
  planStore.setPlan("tenant-1", "plus");
  planStore.setPlan("tenant-2", "plus");
  const auditEvents: string[] = [];

  const referralService = createReferralService({
    repo: referralRepo,
    planStore,
    audit: {
      log: (event) => {
        auditEvents.push(event);
      },
    },
  });

  const stampService = createStampService({
    tokenStore,
    cardStore,
    referrals: referralService,
    planStore,
  });

  const idempotency = createIdempotencyMiddleware(new InMemoryIdempotencyStore());
  const tokenIdempotencyStore = new InMemoryIdempotencyStore();

  const readHeader = (req: import("node:http").IncomingMessage, name: string): string | undefined => {
    const value = req.headers[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  };

  const getTestTenant = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-tenant-id") ?? "tenant-1";
  const getTestCard = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-card-id") ?? "card-1";
  const shouldSkipContext = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-no-context") === "1";
  const shouldSkipHost = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-no-host") === "1";

  const server = createServer((req, res) => {
    if (shouldSkipHost(req)) {
      delete req.headers.host;
      delete req.headers["x-forwarded-host"];
      delete req.headers["x-forwarded-proto"];
    }
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/stamps/tokens") {
      const stampReq = req as AdminAuthRequest & DeviceAuthRequest;
      if (!shouldSkipContext(req)) {
        stampReq.context = {
          device: {
            tenantId: getTestTenant(req),
            deviceId: "device-1",
          },
        };
      }
      void handleStampTokens(stampReq, res, { service: stampService, idempotencyStore: tokenIdempotencyStore });
      return;
    }
    if (req.method === "POST" && path === "/stamps/claim") {
      void (async () => {
        (req as { body?: unknown }).body = await readJsonBody(req);
        if (!shouldSkipContext(req)) {
          (req as { context?: { cardId?: string } }).context = { cardId: getTestCard(req) };
        }
        const idemOk = await idempotency(req, res);
        if (!idemOk) return;
        await handleStampClaim(req, res, { service: stampService });
      })();
      return;
    }
    if (req.method === "GET" && path === "/referrals/link") {
      if (!shouldSkipContext(req)) {
        (req as { context?: { tenantId?: string; cardId?: string } }).context = {
          tenantId: getTestTenant(req),
          cardId: getTestCard(req),
        };
      }
      void handleGetReferralLink(req, res, { service: referralService });
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    planStore,
    auditEvents,
    cardStore,
  };
}
