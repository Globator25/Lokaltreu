import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createStampService, InMemoryCardStateStore, InMemoryStampTokenStore } from "../../src/modules/stamps/stamp.service.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../../src/mw/idempotency.js";
import { readJsonBody } from "../../src/handlers/http-utils.js";
import { handleStampClaim } from "../../src/handlers/stamps/claim.js";
import {
  createPlanUsageTracker,
  InMemoryPlanCounterStore,
  InMemoryTenantPlanStore,
} from "../../src/plan/plan-policy.js";
import { InMemoryPlanWarningDedupStore } from "../../src/plan/plan-dedup-store.js";
import {
  getCurrentPeriodKeyForTest,
  seedUsage100Percent,
  seedUsage79Percent,
  seedUsage80Percent,
} from "../../src/plan/plan-test-helpers.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  events: { event: string; tenantId: string; usagePercent: number }[];
  createToken: () => Promise<{ qrToken: string }>;
  counterStore: InMemoryPlanCounterStore;
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

async function startSoftLimitServer(): Promise<ServerHandle> {
  const tokenStore = new InMemoryStampTokenStore();
  const cardStore = new InMemoryCardStateStore();
  const planStore = new InMemoryTenantPlanStore();
  planStore.setPlan("tenant-1", "plus");

  const now = new Date("2025-01-15T00:00:00.000Z");
  const counterStore = new InMemoryPlanCounterStore();
  const warningDedupStore = new InMemoryPlanWarningDedupStore(() => now.getTime());
  const usageTracker = createPlanUsageTracker({
    planStore,
    counterStore,
    warningDedupStore,
    now: () => now,
  });

  const events: { event: string; tenantId: string; usagePercent: number }[] = [];
  const planUsage = {
    recordStamp: async (params: { tenantId: string; correlationId: string }) => {
      const usage = await usageTracker.recordStamp({
        tenantId: params.tenantId,
        plan: "plus",
        correlationId: params.correlationId,
      });
      if (!usage || !usage.threshold || !usage.shouldNotify) {
        return;
      }
      const event =
        usage.threshold === 100 ? "plan.limit.upgrade_signal_emitted" : "plan.limit.warning_emitted";
      events.push({ event, tenantId: params.tenantId, usagePercent: usage.usagePercent });
    },
  };

  const stampService = createStampService({
    tokenStore,
    cardStore,
    planUsage,
  });

  const idempotency = createIdempotencyMiddleware(new InMemoryIdempotencyStore());

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
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

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    events,
    createToken: async () => stampService.createToken({ tenantId: "tenant-1", deviceId: "device-1" }),
    counterStore,
  };
}

describe("plan soft limits for stamps", () => {
  let serverHandle: ServerHandle | null = null;
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.PLAN_LIMIT_STAMPS_PLUS = "100";
  });

  afterEach(async () => {
    process.env = { ...envBackup };
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("does not emit warning at 79%", async () => {
    process.env.PLAN_LIMIT_STAMPS_PLUS = "201";
    serverHandle = await startSoftLimitServer();
    await seedUsage79Percent({
      tenantId: "tenant-1",
      stampsLimit: 201,
      counterStore: serverHandle.counterStore,
      periodKey: getCurrentPeriodKeyForTest(new Date("2025-01-15T00:00:00.000Z")),
    });

    const token = await serverHandle.createToken();

    const res = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "soft-limit-79",
      },
      body: JSON.stringify({ qrToken: token.qrToken }),
    });

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.cardState).toBeDefined();
    expect(serverHandle.events).toHaveLength(0);
  });

  it("emits warning once at 80%", async () => {
    serverHandle = await startSoftLimitServer();
    await seedUsage80Percent({
      tenantId: "tenant-1",
      stampsLimit: 100,
      counterStore: serverHandle.counterStore,
      periodKey: getCurrentPeriodKeyForTest(new Date("2025-01-15T00:00:00.000Z")),
    });

    const token = await serverHandle.createToken();

    const res = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "soft-limit-80",
      },
      body: JSON.stringify({ qrToken: token.qrToken }),
    });

    expect(res.status).toBe(200);
    expect(serverHandle.events).toHaveLength(1);
    expect(serverHandle.events[0].event).toBe("plan.limit.warning_emitted");
    expect(serverHandle.events[0].tenantId).toBe("tenant-1");
  });

  it("emits upgrade signal at 100% and remains non-blocking", async () => {
    serverHandle = await startSoftLimitServer();
    await seedUsage100Percent({
      tenantId: "tenant-1",
      stampsLimit: 100,
      counterStore: serverHandle.counterStore,
      periodKey: getCurrentPeriodKeyForTest(new Date("2025-01-15T00:00:00.000Z")),
    });

    const token = await serverHandle.createToken();

    const res = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "soft-limit-100",
      },
      body: JSON.stringify({ qrToken: token.qrToken }),
    });

    expect(res.status).toBe(200);
    expect(serverHandle.events).toHaveLength(1);
    expect(serverHandle.events[0].event).toBe("plan.limit.upgrade_signal_emitted");
  });

  it("deduplicates warnings within 24 hours", async () => {
    serverHandle = await startSoftLimitServer();
    await seedUsage80Percent({
      tenantId: "tenant-1",
      stampsLimit: 100,
      counterStore: serverHandle.counterStore,
      periodKey: getCurrentPeriodKeyForTest(new Date("2025-01-15T00:00:00.000Z")),
    });

    const token1 = await serverHandle.createToken();
    const token2 = await serverHandle.createToken();

    const first = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "soft-limit-dedupe-1",
      },
      body: JSON.stringify({ qrToken: token1.qrToken }),
    });

    const second = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "soft-limit-dedupe-2",
      },
      body: JSON.stringify({ qrToken: token2.qrToken }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(serverHandle.events).toHaveLength(1);
    expect(serverHandle.events[0].event).toBe("plan.limit.warning_emitted");
  });
});
