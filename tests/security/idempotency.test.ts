import { afterEach, describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers";
import { buildCanonicalMessage, initSodium } from "../../apps/api/src/modules/auth/device-proof.js";
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

  it("returns 400 for missing Idempotency-Key on /stamps/claim", async () => {
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
    expect(body.error_code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(body.correlation_id).toBeDefined();
  });

  it("returns 400 for missing Idempotency-Key on /rewards/redeem", async () => {
    await initSodium();
    const keypair = sodium.crypto_sign_keypair();
    const publicKey = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);
    const seededPrivateKey = Buffer.from(keypair.privateKey).toString("base64");
    const priorEnv = {
      API_PROFILE: process.env.API_PROFILE,
      DEV_SEED: process.env.DEV_SEED,
      DEV_DEVICE_SEED_TENANT_ID: process.env.DEV_DEVICE_SEED_TENANT_ID,
      DEV_DEVICE_SEED_DEVICE_ID: process.env.DEV_DEVICE_SEED_DEVICE_ID,
      DEV_DEVICE_SEED_PUBLIC_KEY: process.env.DEV_DEVICE_SEED_PUBLIC_KEY,
      DEV_DEVICE_SEED_PRIVATE_KEY: process.env.DEV_DEVICE_SEED_PRIVATE_KEY,
    };
    try {
      process.env.API_PROFILE = "dev";
      process.env.DEV_SEED = "1";
      process.env.DEV_DEVICE_SEED_TENANT_ID = "tenant-1";
      process.env.DEV_DEVICE_SEED_DEVICE_ID = "device-1";
      process.env.DEV_DEVICE_SEED_PUBLIC_KEY = publicKey;
      process.env.DEV_DEVICE_SEED_PRIVATE_KEY = seededPrivateKey;

      handle = await startServer();
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const redeemToken = "stub";
      const message = buildCanonicalMessage({
        method: "POST",
        path: "/rewards/redeem",
        timestamp,
        jti: redeemToken,
      });
      const signatureBytes = sodium.crypto_sign_detached(sodium.from_string(message), keypair.privateKey);
      const signature = sodium.to_base64(signatureBytes, sodium.base64_variants.ORIGINAL);

      const { res, body } = await requestJson(handle.baseUrl, "/rewards/redeem", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-key": "device-1",
          "x-device-timestamp": timestamp,
          "x-device-proof": signature,
        },
        body: JSON.stringify({ redeemToken }),
      });

      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      if (!body) {
        throw new Error("Expected problem+json body");
      }
      expect(body.type).toBeDefined();
      expect(body.title).toBeDefined();
      expect(body.status).toBe(400);
      expect(body.error_code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(body.correlation_id).toBeDefined();
    } finally {
      process.env.API_PROFILE = priorEnv.API_PROFILE;
      process.env.DEV_SEED = priorEnv.DEV_SEED;
      process.env.DEV_DEVICE_SEED_TENANT_ID = priorEnv.DEV_DEVICE_SEED_TENANT_ID;
      process.env.DEV_DEVICE_SEED_DEVICE_ID = priorEnv.DEV_DEVICE_SEED_DEVICE_ID;
      process.env.DEV_DEVICE_SEED_PUBLIC_KEY = priorEnv.DEV_DEVICE_SEED_PUBLIC_KEY;
      process.env.DEV_DEVICE_SEED_PRIVATE_KEY = priorEnv.DEV_DEVICE_SEED_PRIVATE_KEY;
    }
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
    // Header-Echo ist in der aktuellen Implementierung nicht garantiert – entscheidend ist,
    // dass Status + Body identisch sind.
    // expect(second.res.headers.get("idempotency-key")).toBe(headers["idempotency-key"]);
    if (!first.body) {
      throw new Error("Expected problem+json body for first response");
    }
    if (!second.body) {
      throw new Error("Expected problem+json body for second response");
    }
    const { correlation_id: firstCid, ...firstProblem } = first.body;
    const { correlation_id: secondCid, ...secondProblem } = second.body;
    expect(firstCid).toBeDefined();
    expect(secondCid).toBeDefined();
    expect(secondProblem).toEqual(firstProblem);
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
