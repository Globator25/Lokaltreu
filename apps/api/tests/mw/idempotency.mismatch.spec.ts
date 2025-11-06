import { describe, expect, it, vi } from "vitest";
import { requireIdempotency, type IdempotencyContext } from "../../src/mw/idempotency.js";

const baseUrl = "https://lokaltreu.test/stamps/claim";

function makeContext({
  rawBody,
  requestBody,
  redis,
}: {
  rawBody: string;
  requestBody: string;
  redis: IdempotencyContext["redis"];
}): IdempotencyContext {
  const request = new Request(baseUrl, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "Idempotency-Key": "mismatch-key",
    }),
    body: requestBody,
  });

  return {
    request,
    rawBody,
    tenantId: "tenant-mismatch",
    route: "stamps.claim",
    redis,
  };
}

describe("requireIdempotency mismatch handling", () => {
  it("rejects when the same key is reused with a different payload hash", async () => {
    const redisStore = new Map<string, string>();
    const redis = {
      async set(key: string) {
        if (redisStore.has(key)) {
          return null;
        }
        redisStore.set(key, "1");
        return "OK" as const;
      },
    } as unknown as IdempotencyContext["redis"];

    const firstBody = JSON.stringify({ qrToken: "first" });
    const firstContext = makeContext({ rawBody: firstBody, requestBody: firstBody, redis });
    await requireIdempotency(firstContext, vi.fn());

    const secondBody = JSON.stringify({ qrToken: "second" });
    const mismatchContext = makeContext({
      rawBody: firstBody,
      requestBody: secondBody,
      redis,
    });

    await expect(requireIdempotency(mismatchContext, vi.fn())).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 409,
        error_code: "IDEMPOTENT_REPLAY",
      }),
    });
  });
});
