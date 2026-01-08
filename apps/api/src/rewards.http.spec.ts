import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import sodium from "libsodium-wrappers/dist/modules/libsodium-wrappers.js";
import { buildCanonicalMessage, initSodium } from "./modules/auth/device-proof.js";
import { createDeviceAuthMiddleware } from "./middleware/device-auth.js";
import type { DeviceAuthRequest } from "./middleware/device-auth.js";
import type { DeviceRecord } from "./modules/auth/device-repository.js";
import { InMemoryDeviceRepository } from "./modules/auth/device-repository.js";
import { InMemoryDeviceReplayStore } from "./modules/auth/device-replay-store.js";
import { handleRewardRedeem } from "./handlers/rewards/redeem.js";
import { readJsonBody } from "./handlers/http-utils.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "./mw/idempotency.js";
import { InMemoryRewardReplayStore } from "./modules/rewards/reward-replay-store.js";
import {
  createRewardService,
  InMemoryRewardCardStateStore,
  InMemoryRewardTokenStore,
} from "./modules/rewards/reward.service.js";

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

function signProof(input: {
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
  return sodium.to_base64(signatureBytes, BASE64);
}

async function startRewardsServer(input: {
  deviceRecord: DeviceRecord;
  privateKey: Uint8Array;
  seedToken: { redeemToken: string; expiresAt: Date };
}): Promise<ServerHandle> {
  const deviceRepo = new InMemoryDeviceRepository();
  deviceRepo.upsert(input.deviceRecord);
  const deviceReplayStore = new InMemoryDeviceReplayStore();
  const deviceAuth = createDeviceAuthMiddleware({ deviceRepository: deviceRepo, replayStore: deviceReplayStore });
  const idempotency = createIdempotencyMiddleware(new InMemoryIdempotencyStore());

  const tokenStore = new InMemoryRewardTokenStore();
  const cardStore = new InMemoryRewardCardStateStore();
  const replayStore = new InMemoryRewardReplayStore();
  const rewardService = createRewardService({ tokenStore, cardStore, replayStore });

  const redeemToken = input.seedToken.redeemToken;
  await tokenStore.createToken({
    id: redeemToken,
    tenantId: input.deviceRecord.tenantId,
    deviceId: input.deviceRecord.deviceId,
    cardId: "card-1",
    tokenHash: cryptoHash(redeemToken),
    expiresAt: input.seedToken.expiresAt,
  });
  cardStore.seed("card-1", { currentStamps: 0, stampsRequired: 5, rewardsAvailable: 1 });

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/rewards/redeem") {
      void (async () => {
        (req as { body?: unknown }).body = await readJsonBody(req);
        const body = (req as { body?: unknown }).body;
        if (!isRecord(body) || typeof body.redeemToken !== "string") {
          res.statusCode = 400;
          res.end();
          return;
        }

        let allowed = false;
        await deviceAuth(req as DeviceAuthRequest, res, () => {
          allowed = true;
        });
        if (!allowed) return;

        const idemOk = await idempotency(req as DeviceAuthRequest, res);
        if (!idemOk) return;

        await handleRewardRedeem(req as DeviceAuthRequest, res, { service: rewardService });
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function cryptoHash(value: string): string {
  // local inline to avoid importing production helper into tests
  // (must match implementation hashToken: sha256 hex).
  return createHash("sha256").update(value).digest("hex");
}

describe("rewards http integration", () => {
  let serverHandle: ServerHandle | null = null;
  let deviceRecord: DeviceRecord;
  let privateKey: Uint8Array;

  beforeAll(async () => {
    await initSodium();
    const keypair = sodium.crypto_sign_keypair();
    privateKey = keypair.privateKey;
    deviceRecord = {
      tenantId: "tenant-1",
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

  it("returns 403 for invalid proof", async () => {
    const redeemToken = "reward-token-invalid-proof";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey: sodium.crypto_sign_keypair().privateKey,
    });

    const res = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-key": deviceRecord.deviceId,
        "x-device-timestamp": timestamp,
        "x-device-proof": signature,
        "idempotency-key": "reward-403-00000001",
      },
      body: JSON.stringify({ redeemToken }),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("rejects expired tokens with 400 TOKEN_EXPIRED", async () => {
    const redeemToken = "reward-token-expired";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() - 1000) },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey,
    });

    const res = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-key": deviceRecord.deviceId,
        "x-device-timestamp": timestamp,
        "x-device-proof": signature,
        "idempotency-key": "reward-400-00000001",
      },
      body: JSON.stringify({ redeemToken }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error_code).toBe("TOKEN_EXPIRED");
  });

  it("returns 409 TOKEN_REUSE on token reuse", async () => {
    const redeemToken = "reward-token-reuse";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey,
    });

    const headers = {
      "content-type": "application/json",
      "x-device-key": deviceRecord.deviceId,
      "x-device-timestamp": timestamp,
      "x-device-proof": signature,
    };

    const first = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "reward-200-00000001" },
      body: JSON.stringify({ redeemToken }),
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "reward-409-00000001" },
      body: JSON.stringify({ redeemToken }),
    });
    expect(second.status).toBe(409);
    const body = await readJson(second);
    expect(body.error_code).toBe("TOKEN_REUSE");
  });

  it("allows one redeem and blocks parallel reuse attempts", async () => {
    const redeemToken = "reward-token-parallel";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const baseUrl = serverHandle.baseUrl;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey,
    });

    const requests = Array.from({ length: 10 }, (_value, index) =>
      fetch(`${baseUrl}/rewards/redeem`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-key": deviceRecord.deviceId,
          "x-device-timestamp": timestamp,
          "x-device-proof": signature,
          "idempotency-key": `reward-parallel-${index}`,
        },
        body: JSON.stringify({ redeemToken }),
      }),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((res) => res.status);
    const successCount = statuses.filter((status) => status === 200).length;
    const conflictCount = statuses.filter((status) => status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);
  });

  it("returns cached 200 for retries with same Idempotency-Key", async () => {
    const redeemToken = "reward-token-idempotent";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey,
    });

    const headers = {
      "content-type": "application/json",
      "x-device-key": deviceRecord.deviceId,
      "x-device-timestamp": timestamp,
      "x-device-proof": signature,
      "idempotency-key": "reward-idem-00000001",
    };

    const first = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers,
      body: JSON.stringify({ redeemToken }),
    });
    expect(first.status).toBe(200);
    const firstBody = await readJson(first);

    const second = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers,
      body: JSON.stringify({ redeemToken }),
    });
    expect(second.status).toBe(200);
    const secondBody = await readJson(second);

    expect(secondBody).toEqual(firstBody);

    const third = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "reward-idem-00000002" },
      body: JSON.stringify({ redeemToken }),
    });
    expect(third.status).toBe(409);
  });

  it("accepts proofs that include forwarded path prefix", async () => {
    const redeemToken = "reward-token-forwarded-prefix";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const priorTrustProxy = process.env.TRUST_PROXY;
    try {
      process.env.TRUST_PROXY = "1";
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signProof({
        method: "POST",
        path: "/v2/rewards/redeem",
        timestamp,
        jti: redeemToken,
        privateKey,
      });

      const res = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-key": deviceRecord.deviceId,
          "x-device-timestamp": timestamp,
          "x-device-proof": signature,
          "x-forwarded-prefix": "/v2",
          "idempotency-key": "reward-forwarded-00000001",
        },
        body: JSON.stringify({ redeemToken }),
      });

      expect(res.status).toBe(200);
    } finally {
      process.env.TRUST_PROXY = priorTrustProxy;
    }
  });

  it("rejects proofs signed for a different path", async () => {
    const redeemToken = "reward-token-wrong-path";
    serverHandle = await startRewardsServer({
      deviceRecord,
      privateKey,
      seedToken: { redeemToken, expiresAt: new Date(Date.now() + 60_000) },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signProof({
      method: "POST",
      path: "/v2/rewards/redeem",
      timestamp,
      jti: redeemToken,
      privateKey,
    });

    const res = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-key": deviceRecord.deviceId,
        "x-device-timestamp": timestamp,
        "x-device-proof": signature,
        "idempotency-key": "reward-wrong-path-00000001",
      },
      body: JSON.stringify({ redeemToken }),
    });

    expect(res.status).toBe(403);
  });
});
