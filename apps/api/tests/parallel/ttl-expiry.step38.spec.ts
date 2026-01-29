import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import sodium from "libsodium-wrappers";
import { buildCanonicalMessage, initSodium } from "../../src/modules/auth/device-proof.js";
import { createDeviceAuthMiddleware } from "../../src/middleware/device-auth.js";
import type { DeviceAuthRequest } from "../../src/middleware/device-auth.js";
import type { DeviceRecord } from "../../src/modules/auth/device-repository.js";
import { InMemoryDeviceRepository } from "../../src/modules/auth/device-repository.js";
import { InMemoryDeviceReplayStore } from "../../src/modules/auth/device-replay-store.js";
import { handleRewardRedeem } from "../../src/handlers/rewards/redeem.js";
import { handleStampClaim } from "../../src/handlers/stamps/claim.js";
import { hashToken, readJsonBody } from "../../src/handlers/http-utils.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../../src/mw/idempotency.js";
import { InMemoryRewardReplayStore } from "../../src/modules/rewards/reward-replay-store.js";
import {
  createRewardService,
  InMemoryRewardCardStateStore,
  InMemoryRewardTokenStore,
} from "../../src/modules/rewards/reward.service.js";
import {
  createStampService,
  InMemoryCardStateStore,
  InMemoryStampTokenStore,
} from "../../src/modules/stamps/stamp.service.js";
import { assertProblemJson } from "./_util/assertProblemJson.js";

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

function cryptoHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function startStampServer(): Promise<ServerHandle> {
  const tokenStore = new InMemoryStampTokenStore();
  const cardStore = new InMemoryCardStateStore();
  const service = createStampService({ tokenStore, cardStore });

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/stamps/claim") {
      void handleStampClaim(req, res, { service });
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, tokenStore } as ServerHandle & {
    tokenStore: InMemoryStampTokenStore;
  };
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

describe("step-38: TTL expiry", () => {
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

  it("StampToken expires -> claim returns TTL-expired problem+json", async () => {
    const handle = (await startStampServer()) as ServerHandle & {
      tokenStore: InMemoryStampTokenStore;
    };
    serverHandle = handle;

    const qrToken = "step38-expired-stamp-token";
    await handle.tokenStore.createToken({
      id: "step38-expired-stamp-id",
      tenantId: "tenant-1",
      deviceId: "device-1",
      tokenHash: hashToken(qrToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await fetch(`${handle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "step38-stamp-expired-1" },
      body: JSON.stringify({ qrToken }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    assertProblemJson(res.headers.get("content-type"), body);
  });

  it("RewardToken expires -> redeem returns TTL-expired problem+json", async () => {
    const redeemToken = "step38-expired-reward-token";
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
        "idempotency-key": "step38-reward-expired-1",
      },
      body: JSON.stringify({ redeemToken }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    assertProblemJson(res.headers.get("content-type"), body);
  });
});
