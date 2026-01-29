import { afterEach, describe, expect, it } from "vitest";
import { createAppServer } from "../../src/index.js";
import { runParallel } from "./_util/parallel.js";
import { assertProblemJson } from "./_util/assertProblemJson.js";

type ServerHandle = {
  server: ReturnType<typeof createAppServer>["server"];
  baseUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function startServer(): Promise<ServerHandle> {
  const { server } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("step-38: rate-limit burst", () => {
  let handle: ServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await new Promise<void>((resolve) => handle?.server.close(() => resolve()));
      handle = null;
    }
  });

  it("step-38: burst on /stamps/claim triggers at least one 429", async () => {
    handle = await startServer();
    const baseUrl = handle.baseUrl;
    const headers = {
      "content-type": "application/json",
      "x-tenant-id": "tenant-step38-rl",
      "x-card-id": "card-step38-rl",
    };

    const results = await runParallel(40, (index) =>
      fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `step38-rl-claim-${index}`,
        },
        body: JSON.stringify({ qrToken: `stub-rl-${index}` }),
      })
    );

    const statuses = results.map((result) => result.status).filter((status): status is number => !!status);
    const rateLimited = results.filter((result) => result.status === 429);

    expect(statuses.length).toBe(results.length);
    expect(rateLimited.length).toBeGreaterThan(0);

    for (const result of rateLimited) {
      const contentType = result.headers?.["content-type"] ?? null;
      if (!result.json || !isRecord(result.json)) {
        throw new Error("Expected problem+json body for 429 response");
      }
      assertProblemJson(contentType, result.json);
      const retryAfter = result.headers?.["retry-after"];
      if (typeof retryAfter === "string" && retryAfter.trim().length > 0) {
        const retryAfterValue = Number(retryAfter);
        expect(Number.isFinite(retryAfterValue)).toBe(true);
        expect(retryAfterValue).toBeGreaterThan(0);
      }
    }
  });
});
