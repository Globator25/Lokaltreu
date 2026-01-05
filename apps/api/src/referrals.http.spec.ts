import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import { handleGetReferralLink } from "./handlers/referrals/link.js";
import { handleStampClaim } from "./handlers/stamps/claim.js";
import { handleStampTokens } from "./handlers/stamps/tokens.js";
import { readJsonBody } from "./handlers/http-utils.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "./mw/idempotency.js";
import { createStampService, InMemoryCardStateStore, InMemoryStampTokenStore } from "./modules/stamps/stamp.service.js";
import { InMemoryReferralRepository } from "./repositories/referrals.repo.js";
import { InMemoryTenantPlanStore } from "./services/plan-gate.js";
import { createReferralService } from "./services/referrals.service.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  planStore: InMemoryTenantPlanStore;
  auditEvents: string[];
  cardStore: InMemoryCardStateStore;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error("Expected JSON object");
  }
  return data;
}

function extractCode(refCodeURL: string): string {
  const url = new URL(refCodeURL);
  const parts = url.pathname.split("/").filter(Boolean);
  const code = parts[parts.length - 1];
  if (!code) {
    throw new Error("Missing referral code in URL");
  }
  return code;
}

// TODO: Replace in-memory repos with a DB-backed test harness once available.
async function startReferralServer(): Promise<ServerHandle> {
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
      const stampReq = req as AdminAuthRequest;
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

describe("referrals http integration", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("blocks starter plan on GET /referrals/link", async () => {
    serverHandle = await startReferralServer();
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(body.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(typeof body.correlation_id).toBe("string");
  });

  it("returns 401 when auth context is missing for GET /referrals/link", async () => {
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-no-context": "1",
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(typeof body.correlation_id).toBe("string");
  });

  it("builds referral link from configured base URL", async () => {
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(typeof body.refCodeURL).toBe("string");
    expect(body.refCodeURL).toMatch(/^https:\/\/pwa\.example\/r\//);
  });

  it("returns 500 when referral base URL is invalid", async () => {
    process.env.REFERRAL_LINK_BASE_URL = "http://invalid.local/r/";
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(typeof body.correlation_id).toBe("string");
  });

  it("returns 500 when no base URL or host headers are available", async () => {
    process.env.REFERRAL_LINK_BASE_URL = "";
    process.env.REFERRAL_BASE_URL = "";
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-no-host": "1",
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(typeof body.correlation_id).toBe("string");
  });

  it("builds referral link from host header when no base URL is configured", async () => {
    process.env.REFERRAL_LINK_BASE_URL = "";
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        host: "tenant.example",
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(200);
    const body = await readJson(res);
    const url = new URL(body.refCodeURL as string);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toMatch(/^\/r\//);
    expect(url.host).toBeTruthy();
  });

  it("builds referral link from forwarded headers when no base URL is configured", async () => {
    process.env.REFERRAL_LINK_BASE_URL = "";
    serverHandle = await startReferralServer();

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        host: "ignored.example",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "proxy.example",
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.refCodeURL).toMatch(/^https:\/\/proxy\.example\/r\//);
  });

  it("ignores tenant/card headers when auth context is present", async () => {
    serverHandle = await startReferralServer();
    serverHandle.planStore.setPlan("tenant-1", "plus");
    serverHandle.planStore.setPlan("tenant-2", "starter");

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
        "x-tenant-id": "tenant-2",
        "x-card-id": "card-2",
      },
    });

    expect(res.status).toBe(200);
  });

  it("blocks starter plan on /stamps/claim when ref is present", async () => {
    serverHandle = await startReferralServer();
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-starter-1",
        "x-test-tenant-id": "tenant-1",
      },
    });
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken as string;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-claim-starter-1",
        "x-test-card-id": "card-1",
      },
      body: JSON.stringify({ qrToken, ref: "ref-starter" }),
    });
    expect(claimRes.status).toBe(403);
    const claimBody = await readJson(claimRes);
    expect(claimBody.error_code).toBe("PLAN_NOT_ALLOWED");
  });

  it("blocks self referral with 422 SELF_REFERRAL_BLOCKED", async () => {
    serverHandle = await startReferralServer();

    const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });
    const linkBody = await readJson(linkRes);
    const refCode = extractCode(linkBody.refCodeURL as string);

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-self-1",
        "x-test-tenant-id": "tenant-1",
      },
    });
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken as string;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-claim-self-1",
        "x-test-card-id": "card-1",
      },
      body: JSON.stringify({ qrToken, ref: refCode }),
    });
    expect(claimRes.status).toBe(422);
    const body = await readJson(claimRes);
    expect(body.error_code).toBe("SELF_REFERRAL_BLOCKED");
  });

  it("rejects tenant mismatch with 409 REFERRAL_TENANT_MISMATCH", async () => {
    serverHandle = await startReferralServer();

    const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "card-1",
      },
    });
    const linkBody = await readJson(linkRes);
    const refCode = extractCode(linkBody.refCodeURL as string);

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-tenant-mismatch",
        "x-test-tenant-id": "tenant-2",
      },
    });
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken as string;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-claim-tenant-mismatch",
        "x-test-card-id": "card-2",
      },
      body: JSON.stringify({ qrToken, ref: refCode }),
    });
    expect(claimRes.status).toBe(409);
    const body = await readJson(claimRes);
    expect(body.error_code).toBe("REFERRAL_TENANT_MISMATCH");
  });

  it("enforces velocity limit with 422 REFERRAL_LIMIT_REACHED", async () => {
    serverHandle = await startReferralServer();
    const tenantId = "tenant-1";
    const referrerCardId = "referrer-1";

    for (let i = 0; i < 5; i += 1) {
      const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
        method: "GET",
        headers: {
          "x-test-tenant-id": tenantId,
          "x-test-card-id": referrerCardId,
        },
      });
      const linkBody = await readJson(linkRes);
      const refCode = extractCode(linkBody.refCodeURL as string);

      const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `stamp-token-velocity-${i}`,
          "x-test-tenant-id": tenantId,
        },
      });
      const tokenBody = await readJson(tokenRes);
      const qrToken = tokenBody.qrToken as string;

      const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `stamp-claim-velocity-${i}`,
          "x-test-card-id": `referred-${i}`,
        },
        body: JSON.stringify({ qrToken, ref: refCode }),
      });
      expect(claimRes.status).toBe(200);
    }

    const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": tenantId,
        "x-test-card-id": referrerCardId,
      },
    });
    const linkBody = await readJson(linkRes);
    const refCode = extractCode(linkBody.refCodeURL as string);

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-velocity-5",
        "x-test-tenant-id": tenantId,
      },
    });
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken as string;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-claim-velocity-5",
        "x-test-card-id": "referred-5",
      },
      body: JSON.stringify({ qrToken, ref: refCode }),
    });
    expect(claimRes.status).toBe(422);
    const body = await readJson(claimRes);
    expect(body.error_code).toBe("REFERRAL_LIMIT_REACHED");
  });

  it("qualifies first stamp, awards bonus, and emits audit events", async () => {
    serverHandle = await startReferralServer();

    const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "referrer-2",
      },
    });
    const linkBody = await readJson(linkRes);
    const refCode = extractCode(linkBody.refCodeURL as string);

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-happy-1",
        "x-test-tenant-id": "tenant-1",
      },
    });
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken as string;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-claim-happy-1",
        "x-test-card-id": "referred-happy",
      },
      body: JSON.stringify({ qrToken, ref: refCode }),
    });
    expect(claimRes.status).toBe(200);

    const referrerState = serverHandle.cardStore.getState("referrer-2");
    expect(referrerState?.currentStamps).toBe(1);
    expect(serverHandle.auditEvents).toContain("referral.link.issued");
    expect(serverHandle.auditEvents).toContain("referral.first_stamp.qualified");
    expect(serverHandle.auditEvents).toContain("referral.bonus_stamp.credited");
  });

  it("qualifies referral only once with parallel first-stamp claims", async () => {
    serverHandle = await startReferralServer();

    const linkRes = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-test-tenant-id": "tenant-1",
        "x-test-card-id": "referrer-parallel",
      },
    });
    const linkBody = await readJson(linkRes);
    const refCode = extractCode(linkBody.refCodeURL as string);

    const tokenA = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-parallel-1",
        "x-test-tenant-id": "tenant-1",
      },
    });
    const tokenBodyA = await readJson(tokenA);
    const qrTokenA = tokenBodyA.qrToken as string;

    const tokenB = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "stamp-token-parallel-2",
        "x-test-tenant-id": "tenant-1",
      },
    });
    const tokenBodyB = await readJson(tokenB);
    const qrTokenB = tokenBodyB.qrToken as string;

    const claims = await Promise.all([
      fetch(`${serverHandle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "stamp-claim-parallel-1",
          "x-test-card-id": "referred-parallel",
        },
        body: JSON.stringify({ qrToken: qrTokenA, ref: refCode }),
      }),
      fetch(`${serverHandle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "stamp-claim-parallel-2",
          "x-test-card-id": "referred-parallel",
        },
        body: JSON.stringify({ qrToken: qrTokenB, ref: refCode }),
      }),
    ]);

    expect(claims[0].status).toBe(200);
    expect(claims[1].status).toBe(200);
    const qualifiedCount = serverHandle.auditEvents.filter((event) => event === "referral.first_stamp.qualified").length;
    const bonusCount = serverHandle.auditEvents.filter((event) => event === "referral.bonus_stamp.credited").length;
    expect(qualifiedCount).toBe(1);
    expect(bonusCount).toBe(1);
  });
});
