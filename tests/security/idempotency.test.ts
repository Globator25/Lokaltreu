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

async function requestJson(
  baseUrl: string,
  path: string,
  init: RequestInit
): Promise<{ res: Response; body: Record<string, unknown> | null }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const contentType = res.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") || contentType.includes("application/problem+json")
      ? await readJson(res)
      : null;
  return { res, body };
}

describe("idempotency middleware", () => {
  let handle: ServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await new Promise<void>((resolve) => handle?.server.close(() => resolve()));
      handle = null;
    }
  });

  it("returns 400 for missing Idempotency-Key on hot routes", async () => {
    handle = await startServer();
    const { res, body } = await requestJson(handle.baseUrl, "/stamps/claim", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ qrToken: "stub" }),
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    if (!body) {
      throw new Error("Expected problem+json body");
    }
    expect(body.type).toBeDefined();
    expect(body.title).toBeDefined();
    expect(body.status).toBe(400);
    expect(body.error_code).toBeDefined();
    expect(body.correlation_id).toBeDefined();
  });

  it("returns 400 for missing Idempotency-Key on /rewards/redeem", async () => {
    handle = await startServer();
    const { res, body } = await requestJson(handle.baseUrl, "/rewards/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ redeemToken: "stub" }),
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    if (!body) {
      throw new Error("Expected problem+json body");
    }
    expect(body.type).toBeDefined();
    expect(body.title).toBeDefined();
    expect(body.status).toBe(400);
    expect(body.error_code).toBeDefined();
    expect(body.correlation_id).toBeDefined();
  });

  it("returns identical responses for idempotent replays", async () => {
    handle = await startServer();
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-claim-12345678",
    };
    const payload = { qrToken: "stub" };

    const first = await requestJson(handle.baseUrl, "/stamps/claim", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const second = await requestJson(handle.baseUrl, "/stamps/claim", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    expect(second.res.status).toBe(first.res.status);
    expect(second.res.headers.get("content-type")).toBe(first.res.headers.get("content-type"));
    expect(second.res.headers.get("idempotency-key")).toBe(headers["idempotency-key"]);
    expect(second.body).toEqual(first.body);
  });

  it("replays cached 2xx response for parallel requests with the same idempotency key", async () => {
    const { createServer } = await import("node:http");
    const { createIdempotencyMiddleware, InMemoryIdempotencyStore } = await import(
      "../../apps/api/src/mw/idempotency.js"
    );

    let businessCount = 0;
    const idempotency = createIdempotencyMiddleware(new InMemoryIdempotencyStore());
    const server = createServer(async (req, res) => {
      if (req.method !== "POST" || req.url?.split("?")[0] !== "/stamps/claim") {
        res.statusCode = 404;
        res.end();
        return;
      }

      const body = await new Promise<string>((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
        });
        req.on("end", () => resolve(raw));
        req.on("error", (error) => reject(error));
      });
      (req as { body?: unknown }).body = body ? JSON.parse(body) : null;

      await idempotency(req, res, () => {
        businessCount += 1;
        res.statusCode = 201;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, claimed: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind server");
    }
    handle = { server, baseUrl: `http://127.0.0.1:${address.port}` };

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-parallel-12345678",
    };
    const payload = { qrToken: "stub" };

    const first = await requestJson(handle.baseUrl, "/stamps/claim", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const requests = Array.from({ length: 6 }, () =>
      requestJson(handle!.baseUrl, "/stamps/claim", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    );

    const results = await Promise.all(requests);
    const statuses = results.map((result) => result.res.status);
    const successCount = statuses.filter((status) => status >= 200 && status < 300).length;
    const conflictCount = statuses.filter((status) => status === 409).length;

    expect(first.res.status).toBeGreaterThanOrEqual(200);
    expect(first.res.status).toBeLessThan(300);
    expect(successCount).toBe(results.length);
    expect(conflictCount).toBe(0);
    expect(businessCount).toBe(1);

    if (!first.body) {
      throw new Error("Expected JSON body for idempotency replay baseline");
    }
    for (const result of results) {
      expect(result.res.status).toBe(first.res.status);
      expect(result.body).toEqual(first.body);
    }
  });
});
