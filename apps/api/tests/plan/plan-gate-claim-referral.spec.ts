import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handleStampClaim } from "../../src/handlers/stamps/claim.js";
import { handleStampTokens } from "../../src/handlers/stamps/tokens.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../../src/mw/idempotency.js";
import { createStampService, InMemoryCardStateStore, InMemoryStampTokenStore } from "../../src/modules/stamps/stamp.service.js";
import { InMemoryReferralRepository } from "../../src/repositories/referrals.repo.js";
import { InMemoryTenantPlanStore } from "../../src/services/plan-gate.js";
import { createReferralService } from "../../src/services/referrals.service.js";
import { readJsonBody } from "../../src/handlers/http-utils.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  planStore: InMemoryTenantPlanStore;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCardState(body: Record<string, unknown>): { currentStamps: number; stampsRequired: number } {
  const cardState = body.cardState;
  if (!isRecord(cardState)) {
    throw new Error("Expected cardState object");
  }
  if (typeof cardState.currentStamps !== "number" || typeof cardState.stampsRequired !== "number") {
    throw new Error("Expected numeric cardState fields");
  }
  return { currentStamps: cardState.currentStamps, stampsRequired: cardState.stampsRequired };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error("Expected JSON object");
  }
  return data;
}

async function startClaimServer(): Promise<ServerHandle> {
  const tokenStore = new InMemoryStampTokenStore();
  const cardStore = new InMemoryCardStateStore();
  const referralRepo = new InMemoryReferralRepository();
  const planStore = new InMemoryTenantPlanStore();
  const referralService = createReferralService({
    repo: referralRepo,
    planStore,
  });
  const stampService = createStampService({
    tokenStore,
    cardStore,
    referrals: referralService,
    planStore,
  });
  const idempotency = createIdempotencyMiddleware(new InMemoryIdempotencyStore());
  const tokenIdempotencyStore = new InMemoryIdempotencyStore();

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/stamps/tokens") {
      (req as { context?: { device?: { tenantId: string; deviceId: string } } }).context = {
        device: { tenantId: "tenant-1", deviceId: "device-1" },
      };
      void handleStampTokens(req, res, { service: stampService, idempotencyStore: tokenIdempotencyStore });
      return;
    }
    if (req.method === "POST" && path === "/stamps/claim") {
      void (async () => {
        (req as { body?: unknown }).body = await readJsonBody(req);
        (req as { context?: { cardId?: string } }).context = { cardId: "card-1" };
        const idemOk = await idempotency(req, res);
        if (!idemOk) return;
        await handleStampClaim(req, res, { service: stampService });
      })();
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, planStore };
}

describe("plan gate referral claim", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("blocks starter plan for referral claim with PLAN_NOT_ALLOWED", async () => {
    serverHandle = await startClaimServer();
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-token-1",
      },
    });

    expect(tokenRes.status).toBe(201);
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-1",
      },
      body: JSON.stringify({ qrToken, ref: "ref-code-1" }),
    });

    expect(claimRes.status).toBe(403);
    expect(claimRes.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(claimRes);
    expect(body.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(body.type).toBe("https://errors.lokaltreu.example/plan/not-allowed");
    expect(body.title).toBe("Plan not allowed");
    expect(body.status).toBe(403);
    expect(typeof body.correlation_id).toBe("string");
  });

  it("allows plus plan for referral claim", async () => {
    serverHandle = await startClaimServer();
    serverHandle.planStore.setPlan("tenant-1", "plus");

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-token-2",
      },
    });

    expect(tokenRes.status).toBe(201);
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-2",
      },
      body: JSON.stringify({ qrToken, ref: "ref-code-2" }),
    });

    expect(claimRes.status).toBe(200);
    const body = await readJson(claimRes);
    const cardState = readCardState(body);
    expect(typeof cardState.currentStamps).toBe("number");
    expect(typeof cardState.stampsRequired).toBe("number");
  });

  it("allows premium plan for referral claim", async () => {
    serverHandle = await startClaimServer();
    serverHandle.planStore.setPlan("tenant-1", "premium");

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-token-3",
      },
    });

    expect(tokenRes.status).toBe(201);
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken;

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-3",
      },
      body: JSON.stringify({ qrToken, ref: "ref-code-3" }),
    });

    expect(claimRes.status).toBe(200);
    const body = await readJson(claimRes);
    const cardState = readCardState(body);
    expect(typeof cardState.currentStamps).toBe("number");
  });

  it("replays plan gate rejection consistently for idempotent referral claims", async () => {
    serverHandle = await startClaimServer();
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const tokenRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-token-4",
      },
    });

    expect(tokenRes.status).toBe(201);
    const tokenBody = await readJson(tokenRes);
    const qrToken = tokenBody.qrToken;

    const first = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-idem-1",
      },
      body: JSON.stringify({ qrToken, ref: "ref-code-4" }),
    });

    const second = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-referral-idem-1",
      },
      body: JSON.stringify({ qrToken, ref: "ref-code-4" }),
    });

    expect(first.status).toBe(403);
    expect(second.status).toBe(403);
    const firstBody = await readJson(first);
    const secondBody = await readJson(second);
    expect(firstBody.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(secondBody.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(firstBody.correlation_id).toBe(secondBody.correlation_id);
  });
});
