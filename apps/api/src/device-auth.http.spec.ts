import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import sodium from "libsodium-wrappers";
import { buildCanonicalMessage, initSodium } from "./modules/auth/device-proof.js";
import { createDeviceAuthMiddleware } from "./middleware/device-auth.js";
import type { DeviceAuthRequest } from "./middleware/device-auth.js";
import type { DeviceRecord } from "./modules/auth/device-repository.js";
import { InMemoryDeviceRepository } from "./modules/auth/device-repository.js";
import { InMemoryDeviceReplayStore } from "./modules/auth/device-replay-store.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
};

const BASE64 = sodium.base64_variants.ORIGINAL;

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
  const signatureBytes = sodium.crypto_sign_detached(sodium.from_string(message), input.privateKey);
  return { message, signature: sodium.to_base64(signatureBytes, BASE64) };
}

describe("device auth http integration", () => {
  let serverHandle: ServerHandle | null = null;
  let repo: InMemoryDeviceRepository;
  let replayStore: InMemoryDeviceReplayStore;
  let deviceRecord: DeviceRecord;
  let privateKey: Uint8Array;

  beforeAll(async () => {
    await initSodium();
    const keypair = sodium.crypto_sign_keypair();
    privateKey = keypair.privateKey;
    deviceRecord = {
      tenantId: "tenant-device",
      deviceId: "device-1",
      publicKey: sodium.to_base64(keypair.publicKey, BASE64),
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
