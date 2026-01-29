import { afterEach, describe, expect, it } from "vitest";
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

type DeviceFixture = {
  repo: InMemoryDeviceRepository;
  replayStore: InMemoryDeviceReplayStore;
  record: DeviceRecord;
  privateKey: Uint8Array;
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
  repo.upsert(record);
}

async function createFixture(): Promise<DeviceFixture> {
  await initSodium();
  const repo = new InMemoryDeviceRepository();
  const replayStore = new InMemoryDeviceReplayStore();
  const keypair = sodium.crypto_sign_keypair();
  const record: DeviceRecord = {
    tenantId: "tenant-1",
    deviceId: "device-1",
    publicKey: sodium.to_base64(keypair.publicKey, BASE64),
    algorithm: "ed25519",
    enabled: true,
  };
  seedDevice(repo, record);
  return { repo, replayStore, record, privateKey: keypair.privateKey };
}

async function startServer(fixture: DeviceFixture): Promise<ServerHandle> {
  const middleware = createDeviceAuthMiddleware({
    deviceRepository: fixture.repo,
    replayStore: fixture.replayStore,
  });
  const server = createServer((req, res) => {
    void middleware(req as DeviceAuthRequest, res, () => {
      res.statusCode = 204;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function buildSignature(input: {
  method: string;
  path: string;
  timestamp: string;
  jti: string;
  privateKey: Uint8Array;
}) {
  const message = buildCanonicalMessage({
    method: input.method,
    path: input.path,
    timestamp: input.timestamp,
    jti: input.jti,
  });
  const signatureBytes = sodium.crypto_sign_detached(sodium.from_string(message), input.privateKey);
  return { message, signature: sodium.to_base64(signatureBytes, BASE64) };
}

function buildHeaders(input: {
  deviceKey: string;
  timestamp: string;
  jti: string;
  signature: string;
}) {
  return {
    "x-device-key": input.deviceKey,
    "x-device-timestamp": input.timestamp,
    "x-device-nonce": input.jti,
    "x-device-proof": input.signature,
  };
}

function getBaseUrl(handle: ServerHandle | null): string {
  if (!handle) {
    throw new Error("Server not started");
  }
  return handle.baseUrl;
}

describe("device auth middleware", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("accepts valid device proof", async () => {
    const fixture = await createFixture();
    serverHandle = await startServer(fixture);
    const baseUrl = getBaseUrl(serverHandle);
    const path = "/stamps/tokens";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const jti = "jti-valid";
    const { signature } = buildSignature({
      method: "POST",
      path,
      timestamp,
      jti,
      privateKey: fixture.privateKey,
    });
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: buildHeaders({
        deviceKey: fixture.record.deviceId,
        timestamp,
        jti,
        signature,
      }),
    });
    expect(res.status).toBe(204);
  });

  it("rejects invalid signatures", async () => {
    await initSodium();
    const fixture = await createFixture();
    const otherKey = sodium.crypto_sign_keypair().privateKey;
    serverHandle = await startServer(fixture);
    const baseUrl = getBaseUrl(serverHandle);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const jti = "jti-invalid";
    const { signature } = buildSignature({
      method: "POST",
      path: "/stamps/tokens",
      timestamp,
      jti,
      privateKey: otherKey,
    });
    const res = await fetch(`${baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: buildHeaders({
        deviceKey: fixture.record.deviceId,
        timestamp,
        jti,
        signature,
      }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("DEVICE_PROOF_INVALID");
  });

  it("rejects timestamps outside the skew window", async () => {
    const fixture = await createFixture();
    serverHandle = await startServer(fixture);
    const baseUrl = getBaseUrl(serverHandle);
    const timestamp = (Math.floor(Date.now() / 1000) + 45).toString();
    const jti = "jti-skew";
    const { signature } = buildSignature({
      method: "POST",
      path: "/stamps/tokens",
      timestamp,
      jti,
      privateKey: fixture.privateKey,
    });
    const res = await fetch(`${baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: buildHeaders({
        deviceKey: fixture.record.deviceId,
        timestamp,
        jti,
        signature,
      }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("DEVICE_PROOF_SKEW");
  });

  it("rejects replays for reused nonces", async () => {
    const fixture = await createFixture();
    serverHandle = await startServer(fixture);
    const baseUrl = getBaseUrl(serverHandle);
    const path = "/stamps/tokens";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const jti = "jti-replay";
    const { signature } = buildSignature({
      method: "POST",
      path,
      timestamp,
      jti,
      privateKey: fixture.privateKey,
    });
    const headers = buildHeaders({
      deviceKey: fixture.record.deviceId,
      timestamp,
      jti,
      signature,
    });

    const sendReplayRequest = async () =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
      });

    const first = await sendReplayRequest();
    expect(first.status).toBe(204);

    const second = await sendReplayRequest();
    console.warn("REPLAY DEBUG status", second.status);
    console.warn("REPLAY DEBUG headers", Object.fromEntries(second.headers.entries()));
    expect(second.status).toBe(409);
    expect(second.headers.get("content-type")).toContain("application/problem+json");
    const rawBody = await second.text();
    console.warn("REPLAY DEBUG raw body", rawBody);
    expect(rawBody.length).toBeGreaterThan(0);
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    expect(body.status).toBe(409);
  });
});
