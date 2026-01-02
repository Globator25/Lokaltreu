import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import type { DeviceAuthRequest } from "./middleware/device-auth.js";
import { handleStampClaim } from "./handlers/stamps/claim.js";
import { handleStampTokens } from "./handlers/stamps/tokens.js";
import { InMemoryIdempotencyStore } from "./mw/idempotency.js";
import {
  createStampService,
  InMemoryCardStateStore,
  InMemoryStampTokenStore,
} from "./modules/stamps/stamp.service.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
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

async function startStampServer(): Promise<ServerHandle> {
  const tokenStore = new InMemoryStampTokenStore();
  const cardStore = new InMemoryCardStateStore();
  const service = createStampService({ tokenStore, cardStore });
  const idempotencyStore = new InMemoryIdempotencyStore();

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && path === "/stamps/tokens") {
      const stampReq = req as AdminAuthRequest & DeviceAuthRequest;
      stampReq.context = {
        device: {
          tenantId: "tenant-1",
          deviceId: "device-1",
        },
      };
      void handleStampTokens(stampReq, res, { service, idempotencyStore });
      return;
    }
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("stamps http integration", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
    vi.useRealTimers();
  });

  it("creates a stamp token and claims it", async () => {
    serverHandle = await startStampServer();

    const createRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-token-00000001" },
    });
    expect(createRes.status).toBe(201);
    const createBody = await readJson(createRes);
    const qrToken = createBody.qrToken;
    expect(typeof qrToken).toBe("string");

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-claim-00000001" },
      body: JSON.stringify({ qrToken }),
    });
    expect(claimRes.status).toBe(200);
    const claimBody = await readJson(claimRes);
    const cardState = claimBody.cardState;
    if (!isRecord(cardState)) {
      throw new Error("Expected cardState in response");
    }
    expect(typeof cardState.currentStamps).toBe("number");
    expect(typeof cardState.stampsRequired).toBe("number");
    expect(typeof cardState.rewardsAvailable).toBe("number");
  });

  it("rejects token reuse with 409", async () => {
    serverHandle = await startStampServer();

    const createRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-token-00000002" },
    });
    const createBody = await readJson(createRes);
    const qrToken = createBody.qrToken;

    const firstClaim = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-claim-00000002" },
      body: JSON.stringify({ qrToken }),
    });
    expect(firstClaim.status).toBe(200);

    const secondClaim = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-claim-00000003" },
      body: JSON.stringify({ qrToken }),
    });
    expect(secondClaim.status).toBe(409);
    const body = await readJson(secondClaim);
    expect(body.error_code).toBe("TOKEN_REUSE");
  });

  it("rejects expired tokens with 400", async () => {
    vi.useFakeTimers();
    const start = new Date("2025-01-01T00:00:00.000Z");
    vi.setSystemTime(start);

    serverHandle = await startStampServer();
    const createRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-token-00000003" },
    });
    const createBody = await readJson(createRes);
    const qrToken = createBody.qrToken;

    vi.setSystemTime(new Date(start.getTime() + 61 * 1000));

    const claimRes = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-claim-00000004" },
      body: JSON.stringify({ qrToken }),
    });
    expect(claimRes.status).toBe(400);
    const body = await readJson(claimRes);
    expect(body.error_code).toBe("TOKEN_EXPIRED");
  });

  it("allows one claim and blocks parallel reuse attempts", async () => {
    serverHandle = await startStampServer();
    const createRes = await fetch(`${serverHandle.baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stamp-token-00000004" },
    });
    const createBody = await readJson(createRes);
    const qrToken = createBody.qrToken as string;

    const requests = Array.from({ length: 10 }, (_value, index) =>
      fetch(`${serverHandle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `stamp-claim-parallel-${index}` },
        body: JSON.stringify({ qrToken }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((res) => res.status);
    const successCount = statuses.filter((status) => status === 200).length;
    const conflictCount = statuses.filter((status) => status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);
  });
});
