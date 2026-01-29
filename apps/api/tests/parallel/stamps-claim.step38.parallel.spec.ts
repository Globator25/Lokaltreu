import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AdminAuthRequest } from "../../src/mw/admin-auth.js";
import type { DeviceAuthRequest } from "../../src/middleware/device-auth.js";
import { handleStampClaim } from "../../src/handlers/stamps/claim.js";
import { handleStampTokens } from "../../src/handlers/stamps/tokens.js";
import {
  createStampService,
  InMemoryCardStateStore,
  InMemoryStampTokenStore,
} from "../../src/modules/stamps/stamp.service.js";
import { InMemoryIdempotencyStore } from "../../src/mw/idempotency.js";
import { runParallel } from "./_util/parallel.js";
import { assertProblemJson } from "./_util/assertProblemJson.js";

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

describe("step-38: stamps/claim parallel", () => {
  let serverHandle: ServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("step-38: allows one claim and rejects 9 replays", async () => {
    serverHandle = await startStampServer();
    const baseUrl = serverHandle.baseUrl;

    const createRes = await fetch(`${baseUrl}/stamps/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "step38-stamp-token-0001" },
    });
    expect(createRes.status).toBe(201);
    const createBody = await readJson(createRes);
    const qrToken = createBody.qrToken;
    expect(typeof qrToken).toBe("string");

    const results = await runParallel(10, (index) =>
      fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `step38-stamp-claim-${index}`,
        },
        body: JSON.stringify({ qrToken }),
      })
    );

    const statuses = results.map((result) => result.status).filter((status): status is number => !!status);
    const successCount = statuses.filter((status) => status === 200).length;
    const conflictCount = statuses.filter((status) => status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);

    for (const result of results) {
      if (result.status !== 409) continue;
      const contentType = result.headers?.["content-type"] ?? null;
      if (!result.json || !isRecord(result.json)) {
        throw new Error("Expected problem+json body for 409 response");
      }
      assertProblemJson(contentType, result.json);
    }
  });
});
