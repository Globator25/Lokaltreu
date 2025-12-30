import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import { handleDeviceRegistrationConfirm } from "./handlers/devices/register-confirm.js";
import { handleDeviceRegistrationLinks } from "./handlers/devices/registration-links.js";
import type { DbClientLike } from "./modules/devices/deviceRegistrationLinks.repo.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
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
        return row
          ? { rows: [row] as T[], rowCount: 1 }
          : { rows: [] as T[], rowCount: 0 };
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

async function startDeviceOnboardingServer(db: DbClientLike): Promise<ServerHandle> {
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
      void handleDeviceRegistrationLinks(req as AdminAuthRequest, res, { db });
      return;
    }
    if (req.method === "POST" && path === "/devices/register/confirm") {
      void handleDeviceRegistrationConfirm(req, res, { db });
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("device onboarding http integration", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("creates a registration link and confirms it", async () => {
    const db = createInMemoryDbClient();
    serverHandle = await startDeviceOnboardingServer(db);

    const createRes = await fetch(`${serverHandle.baseUrl}/devices/registration-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(createRes.status).toBe(201);
    const createBody = await readJson(createRes);
    const token = createBody.token;
    expect(typeof token).toBe("string");

    const confirmRes = await fetch(`${serverHandle.baseUrl}/devices/register/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(confirmRes.status).toBe(204);
  });

  it("rejects token reuse with problem+json", async () => {
    const db = createInMemoryDbClient();
    serverHandle = await startDeviceOnboardingServer(db);

    const createRes = await fetch(`${serverHandle.baseUrl}/devices/registration-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const createBody = await readJson(createRes);
    const token = createBody.token;

    const firstConfirm = await fetch(`${serverHandle.baseUrl}/devices/register/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(firstConfirm.status).toBe(204);

    const secondConfirm = await fetch(`${serverHandle.baseUrl}/devices/register/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(secondConfirm.status).toBe(409);
    const body = await readJson(secondConfirm);
    expect(secondConfirm.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("TOKEN_REUSE");
  });
});
