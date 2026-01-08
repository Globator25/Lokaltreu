import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AdminAuthRequest } from "../../src/mw/admin-auth.js";
import { handleDeviceRegistrationConfirm } from "../../src/handlers/devices/register-confirm.js";
import { handleDeviceRegistrationLinks } from "../../src/handlers/devices/registration-links.js";
import type { DbClientLike } from "../../src/modules/devices/deviceRegistrationLinks.repo.js";
import { InMemoryIdempotencyStore } from "../../src/mw/idempotency.js";
import { InMemoryActiveDeviceStore, InMemoryTenantPlanStore } from "../../src/plan/plan-policy.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  planStore: InMemoryTenantPlanStore;
  activeDeviceStore: InMemoryActiveDeviceStore;
};

type DeviceRegistrationLinkRow = {
  id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  device_id: string | null;
  created_by_admin_id: string | null;
  created_at: Date;
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

function createInMemoryDbClient(): DbClientLike {
  const rowsById = new Map<string, DeviceRegistrationLinkRow>();
  const idByTokenHash = new Map<string, string>();

  return {
    async query<T = unknown>(sql: string, params?: unknown[]) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("INSERT INTO device_registration_links")) {
        const [id, tenantId, tokenHash, expiresAt, adminId] = params as [
          string,
          string,
          string,
          Date,
          string | null,
        ];
        const row: DeviceRegistrationLinkRow = {
          id,
          tenant_id: tenantId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          used_at: null,
          device_id: null,
          created_by_admin_id: adminId ?? null,
          created_at: new Date(),
        };
        rowsById.set(id, row);
        idByTokenHash.set(tokenHash, id);
        return { rows: [row] as T[], rowCount: 1 };
      }
      if (
        normalized.startsWith("SELECT") &&
        normalized.includes("FROM device_registration_links") &&
        normalized.includes("WHERE token_hash = $1")
      ) {
        const tokenHash = params?.[0] as string;
        const id = idByTokenHash.get(tokenHash);
        if (!id) {
          return { rows: [] as T[], rowCount: 0 };
        }
        const row = rowsById.get(id);
        return row ? { rows: [row] as T[], rowCount: 1 } : { rows: [] as T[], rowCount: 0 };
      }
      if (
        normalized.startsWith("UPDATE device_registration_links") &&
        normalized.includes("SET used_at = now(), device_id = $2")
      ) {
        const [id, deviceId] = params as [string, string];
        const row = rowsById.get(id);
        if (!row || row.used_at) {
          return { rows: [] as T[], rowCount: 0 };
        }
        row.used_at = new Date();
        row.device_id = deviceId;
        return { rows: [] as T[], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL in test DB: ${normalized}`);
    },
  };
}

async function startDeviceLimitServer(db: DbClientLike): Promise<ServerHandle> {
  const idempotencyStore = new InMemoryIdempotencyStore();
  const planStore = new InMemoryTenantPlanStore();
  const activeDeviceStore = new InMemoryActiveDeviceStore();

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/devices/registration-links") {
      (req as AdminAuthRequest).context = {
        admin: {
          tenantId: "tenant-1",
          adminId: "admin-1",
          token: "admin-token",
          expiresAt: Math.floor(Date.now() / 1000) + 900,
        },
      };
      void handleDeviceRegistrationLinks(req as AdminAuthRequest, res, { db, idempotencyStore });
      return;
    }
    if (req.method === "POST" && path === "/devices/register/confirm") {
      void handleDeviceRegistrationConfirm(req, res, { db, planStore, activeDeviceStore });
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, planStore, activeDeviceStore };
}

describe("plan device limits", () => {
  let serverHandle: ServerHandle | null = null;
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.PLAN_LIMIT_DEVICES_STARTER = "1";
  });

  afterEach(async () => {
    process.env = { ...envBackup };
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("allows device registration when under limit", async () => {
    const db = createInMemoryDbClient();
    serverHandle = await startDeviceLimitServer(db);
    serverHandle.planStore.setPlan("tenant-1", "starter");

    const createRes = await fetch(`${serverHandle.baseUrl}/devices/registration-links`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "plan-device-ok-1" },
      body: JSON.stringify({}),
    });

    expect(createRes.status).toBe(201);
    const createBody = await readJson(createRes);
    const token = createBody.token;

    const confirmRes = await fetch(`${serverHandle.baseUrl}/devices/register/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "plan-device-ok-2" },
      body: JSON.stringify({ token }),
    });

    expect(confirmRes.status).toBe(204);
  });

  it("blocks device registration when limit reached", async () => {
    const db = createInMemoryDbClient();
    serverHandle = await startDeviceLimitServer(db);
    serverHandle.planStore.setPlan("tenant-1", "starter");
    await serverHandle.activeDeviceStore.markActive({ tenantId: "tenant-1", deviceId: "device-1" });

    const createRes = await fetch(`${serverHandle.baseUrl}/devices/registration-links`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "plan-device-block-1" },
      body: JSON.stringify({}),
    });

    expect(createRes.status).toBe(201);
    const createBody = await readJson(createRes);
    const token = createBody.token;

    const confirmRes = await fetch(`${serverHandle.baseUrl}/devices/register/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "plan-device-block-2" },
      body: JSON.stringify({ token }),
    });

    expect(confirmRes.status).toBe(403);
    expect(confirmRes.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(confirmRes);
    expect(body.error_code).toBe("PLAN_NOT_ALLOWED");
    expect(body.type).toBe("https://errors.lokaltreu.example/plan/not-allowed");
    expect(body.title).toBe("Plan not allowed");
    expect(body.status).toBe(403);
    expect(typeof body.correlation_id).toBe("string");
    expect(body.correlation_id).not.toBe("");
  });
});
