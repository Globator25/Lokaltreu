import { afterEach, describe, expect, it } from "vitest";
import { createAppServer } from "../../apps/api/src/index.js";

type ServerHandle = {
  server: ReturnType<typeof createAppServer>["server"];
  baseUrl: string;
};

async function startServer(): Promise<ServerHandle> {
  const { server } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

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

async function requestJson(baseUrl: string, path: string, init: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const contentType = res.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/problem+json") || contentType.includes("application/json")
      ? await readJson(res)
      : null;
  return { res, body };
}

describe("rate-limit middleware (real stack)", () => {
  let handle: ServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await new Promise<void>((resolve) => handle?.server.close(() => resolve()));
      handle = null;
    }
  });

  it("allows requests under the card limit on /stamps/claim", async () => {
    handle = await startServer();
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-claim-12345678",
      "x-tenant-id": "tenant-1",
      "x-card-id": "card-1",
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await fetch(`${handle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers,
        body: JSON.stringify({ qrToken: `stub-${i}` }),
      });
      expect(res.status).not.toBe(429);
    }
  });

  it("enforces card limit on /stamps/claim", async () => {
    handle = await startServer();
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-claim-abcdefgh",
      "x-tenant-id": "tenant-2",
      "x-card-id": "card-2",
    };

    let lastResponse: Response | null = null;
    for (let i = 0; i < 31; i += 1) {
      lastResponse = await fetch(`${handle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers,
        body: JSON.stringify({ qrToken: `stub-${i}` }),
      });
    }

    if (!lastResponse) {
      throw new Error("Expected a response");
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers.get("retry-after")).toBeTruthy();
    expect(lastResponse.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(lastResponse);
    expect(body.error_code).toBe("RATE_LIMITED");
    const retryAfter = body.retry_after;
    if (typeof retryAfter !== "number") {
      throw new Error("Expected numeric retry_after");
    }
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("enforces anonymous IP limit when tenant is missing", async () => {
    handle = await startServer();
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-claim-ip-123456",
      "x-forwarded-for": "203.0.113.10",
      "x-card-id": "card-ip",
    };

    let lastResponse: Response | null = null;
    for (let i = 0; i < 121; i += 1) {
      lastResponse = await fetch(`${handle.baseUrl}/stamps/claim`, {
        method: "POST",
        headers,
        body: JSON.stringify({ qrToken: `stub-${i}` }),
      });
    }

    if (!lastResponse) {
      throw new Error("Expected a response");
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers.get("retry-after")).toBeTruthy();
    expect(lastResponse.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(lastResponse);
    expect(body.error_code).toBe("RATE_LIMITED");
    const retryAfter = body.retry_after;
    if (typeof retryAfter !== "number") {
      throw new Error("Expected numeric retry_after");
    }
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });
});
