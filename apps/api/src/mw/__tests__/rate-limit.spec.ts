import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody, sendJson, sendProblem, problem } from "../../handlers/http-utils.js";

const TEST_LIMIT = 3;

vi.mock("../../config/rate-limits.v1.js", () => ({
  RATE_LIMIT_WINDOW_SECONDS: 60,
  globalRateLimits: {
    tenantRpm: 1000,
    ipAnonRpm: 1000,
  },
  routeRateLimits: {
    "POST /stamps/claim": {
      cardRpm: TEST_LIMIT,
    },
    "POST /rewards/redeem": {
      deviceRpm: TEST_LIMIT,
    },
  },
}));

let createRateLimitMiddleware: typeof import("../rate-limit.js").createRateLimitMiddleware;
let InMemoryRateLimitStore: typeof import("../rate-limit.js").InMemoryRateLimitStore;

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

async function startServer(): Promise<ServerHandle> {
  const store = new InMemoryRateLimitStore();
  const rateLimit = createRateLimitMiddleware(store);
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "POST" && (path === "/stamps/claim" || path === "/rewards/redeem")) {
      void (async () => {
        if (req.headers["content-type"]?.includes("application/json") && !("body" in req)) {
          (req as { body?: unknown }).body = await readJsonBody(req);
        }
        const ok = await rateLimit(req, res);
        if (!ok) {
          return;
        }
        sendJson(res, 201, { ok: true });
      })();
      return;
    }
    sendProblem(res, problem(404, "Not Found", "Route not found", path, "TOKEN_REUSE"));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("rate-limit middleware", () => {
  let serverHandle: ServerHandle | null = null;

  beforeAll(async () => {
    const mod = await import("../rate-limit.js");
    createRateLimitMiddleware = mod.createRateLimitMiddleware;
    InMemoryRateLimitStore = mod.InMemoryRateLimitStore;
  });

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("enforces card limit for POST /stamps/claim", async () => {
    serverHandle = await startServer();
    const headers = {
      "content-type": "application/json",
      "x-tenant-id": "tenant-1",
      "x-card-id": "card-1",
    };

    for (let i = 1; i <= TEST_LIMIT; i += 1) {
      const res = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers,
        body: JSON.stringify({ qrToken: `token-${i}` }),
      });
      expect(res.status).toBe(201);
    }

    const blocked = await fetch(`${serverHandle.baseUrl}/stamps/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({ qrToken: "token-blocked" }),
    });
    const body = await readJson(blocked);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("RATE_LIMITED");
    const retryAfter = blocked.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("enforces device limit for POST /rewards/redeem", async () => {
    serverHandle = await startServer();
    const headers = {
      "content-type": "application/json",
      "x-tenant-id": "tenant-1",
      "x-device-id": "device-1",
    };

    for (let i = 1; i <= TEST_LIMIT; i += 1) {
      const res = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
        method: "POST",
        headers,
        body: JSON.stringify({ redeemToken: `token-${i}` }),
      });
      expect(res.status).toBe(201);
    }

    const blocked = await fetch(`${serverHandle.baseUrl}/rewards/redeem`, {
      method: "POST",
      headers,
      body: JSON.stringify({ redeemToken: "token-blocked" }),
    });
    const body = await readJson(blocked);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("RATE_LIMITED");
    const retryAfter = blocked.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
