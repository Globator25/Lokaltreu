import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
// @ts-expect-error fetch types are provided by the Vitest environment
import sodium from "libsodium-wrappers";
import { buildCanonicalMessage, initSodium } from "./modules/auth/device-proof.js";
import { createDeviceAuthMiddleware } from "./middleware/device-auth.js";
import type { DeviceAuthRequest } from "./middleware/device-auth.js";
import type { DeviceRecord } from "./modules/auth/device-repository.js";
import { InMemoryDeviceRepository } from "./modules/auth/device-repository.js";
import { InMemoryDeviceReplayStore } from "./modules/auth/device-replay-store.js";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import { handleDeviceRegistrationConfirm } from "./handlers/devices/register-confirm.js";
import { handleDeviceRegistrationLinks } from "./handlers/devices/registration-links.js";
import type { DbClientLike } from "./modules/devices/deviceRegistrationLinks.repo.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
};

type SodiumLike = {
  base64_variants: { ORIGINAL: number };
  crypto_sign_detached: (message: Uint8Array, privateKey: Uint8Array) => Uint8Array;
  from_string: (input: string) => Uint8Array;
  to_base64: (input: Uint8Array, variant: number) => string;
  crypto_sign_keypair: () => { publicKey: Uint8Array; privateKey: Uint8Array };
};

const sodiumLib = sodium as unknown as SodiumLike;
const BASE64 = sodiumLib.base64_variants.ORIGINAL;

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

function seedDevice(repo: InMemoryDeviceRepository, record: DeviceRecord) {
  const store = repo as unknown as { devices: Map<string, DeviceRecord> };
  store.devices.set(`${record.tenantId}:${record.deviceId}`, record);
}

async function startServer(repo: InMemoryDeviceRepository, replayStore: InMemoryDeviceReplayStore): Promise<ServerHandle> {
  const middleware = createDeviceAuthMiddleware({
    deviceRepository: repo,
    replayStore,
  });
  const server = createServer((req, res) => {
    void middleware(req as DeviceAuthRequest, res, () => {
      res.statusCode = 204;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function signMessage(input: { method: string; path: string; timestamp: string; jti: string; privateKey: Uint8Array }) {
  const message = buildCanonicalMessage({
    method: input.method,
    path: input.path,
    timestamp: input.timestamp,
    nonce: input.jti,
  });
  const signatureBytes = sodiumLib.crypto_sign_detached(
    sodiumLib.from_string(message),
    input.privateKey,
  );
  return { message, signature: sodiumLib.to_base64(signatureBytes, BASE64) };
}

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

describe("device auth http integration", () => {
  let serverHandle: ServerHandle | null = null;
  let repo: InMemoryDeviceRepository;
  let replayStore: InMemoryDeviceReplayStore;
  let deviceRecord: DeviceRecord;
  let privateKey: Uint8Array;

  beforeAll(async () => {
    await initSodium();
    const keypair = sodiumLib.crypto_sign_keypair();
    privateKey = keypair.privateKey;
    deviceRecord = {
      tenantId: "tenant-device",
      deviceId: "device-1",
      publicKey: sodiumLib.to_base64(keypair.publicKey, BASE64),
      algorithm: "ed25519",
      enabled: true,
    };
  });

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("accepts valid device proof headers", async () => {
    repo = new InMemoryDeviceRepository();
    replayStore = new InMemoryDeviceReplayStore();
    seedDevice(repo, deviceRecord);
    serverHandle = await startServer(repo, replayStore);

    const path = "/rewards/redeem";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const jti = "jti-valid";
    const { signature } = signMessage({
      method: "POST",
      path,
      timestamp,
      jti,
      privateKey,
    });

    const res = await fetch(`${serverHandle.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": deviceRecord.tenantId,
        "x-device-id": deviceRecord.deviceId,
        "x-device-nonce": jti,
        "x-device-signature": signature,
        "x-device-timestamp": timestamp,
        "x-device-key": deviceRecord.deviceId,
        "x-device-proof": signature,
        "idempotency-key": "idem-1",
      },
      body: JSON.stringify({ redeemToken: "stub" }),
    });

    expect(res.status).toBe(204);
  });

  it("rejects invalid proofs with problem+json", async () => {
    repo = new InMemoryDeviceRepository();
    replayStore = new InMemoryDeviceReplayStore();
    seedDevice(repo, deviceRecord);
    serverHandle = await startServer(repo, replayStore);

    const path = "/rewards/redeem";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const jti = "jti-invalid";
    const { signature } = signMessage({
      method: "POST",
      path,
      timestamp,
      jti,
      privateKey,
    });

    const res = await fetch(`${serverHandle.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": deviceRecord.tenantId,
        "x-device-id": deviceRecord.deviceId,
        "x-device-nonce": "jti-tampered",
        "x-device-signature": signature,
        "x-device-timestamp": timestamp,
        "x-device-key": deviceRecord.deviceId,
        "x-device-proof": signature,
      },
      body: JSON.stringify({ redeemToken: "stub" }),
    });

    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("DEVICE_PROOF_INVALID");
  });
});

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
