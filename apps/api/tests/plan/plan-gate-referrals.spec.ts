import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handleGetReferralLink } from "../../src/handlers/referrals/link.js";
import { requirePlanFeature as requirePlanFeatureGate } from "../../src/mw/plan-gate.js";
import { InMemoryTenantPlanStore } from "../../src/services/plan-gate.js";
import { InMemoryReferralRepository } from "../../src/repositories/referrals.repo.js";
import { createReferralService } from "../../src/services/referrals.service.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  planStore: InMemoryTenantPlanStore;
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

async function startReferralPlanGateServer(): Promise<ServerHandle> {
  if (!process.env.REFERRAL_LINK_BASE_URL) {
    process.env.REFERRAL_LINK_BASE_URL = "https://pwa.example/r/";
  }
  const planStore = new InMemoryTenantPlanStore();
  const referralRepo = new InMemoryReferralRepository();
  const referralService = createReferralService({
    repo: referralRepo,
    planStore,
  });

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "GET" && path === "/referrals/link") {
      void (async () => {
        const ok = await requirePlanFeatureGate(req, res, { planStore }, "referrals");
        if (!ok) {
          return;
        }
        await handleGetReferralLink(req, res, { service: referralService });
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

describe("plan gate referrals", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("blocks starter plan on GET /referrals/link with PLAN_NOT_ALLOWED", async () => {
    serverHandle = await startReferralPlanGateServer();
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-card-id": "card-1",
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(body.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(body.type).toBe("https://errors.lokaltreu.example/plan/not-allowed");
    expect(body.title).toBe("Plan not allowed");
    expect(body.status).toBe(403);
    expect(typeof body.correlation_id).toBe("string");
    expect(body.correlation_id).not.toBe("");
  });

  it("allows plus plan on GET /referrals/link", async () => {
    serverHandle = await startReferralPlanGateServer();
    serverHandle.planStore.setPlan("tenant-1", "plus");

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-card-id": "card-1",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("allows premium plan on GET /referrals/link", async () => {
    serverHandle = await startReferralPlanGateServer();
    serverHandle.planStore.setPlan("tenant-1", "premium");

    const res = await fetch(`${serverHandle.baseUrl}/referrals/link`, {
      method: "GET",
      headers: {
        "x-tenant-id": "tenant-1",
        "x-card-id": "card-1",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
