import { describe, expect, it } from "vitest";
import { requireIdempotency, type IdempotencyContext } from "../../src/mw/idempotency.js";

class DeterministicRedis {
  private store = new Map<string, number>();

  async set(key: string, _value: string, options: { nx: true; ex: number }): Promise<"OK" | null> {
    const existing = this.store.get(key);
    if (typeof existing === "number" && existing > Date.now()) {
      return null;
    }
    this.store.set(key, Date.now() + options.ex * 1000);
    return "OK";
  }
}

const makeContext = (redis: DeterministicRedis): IdempotencyContext => {
  const body = JSON.stringify({ qrToken: "demo-token" });
  const request = new Request("https://lokaltreu.test/stamps/claim", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "Idempotency-Key": "REPLAY-KEY",
    }),
    body,
  });
  return {
    request,
    tenantId: "tenant-123",
    route: "stamps.claim",
    redis,
    rawBody: body,
  };
};

describe("Idempotency anti-replay guard", () => {
  it("allows the first request and rejects the following duplicates within the TTL window", async () => {
    const redis = new DeterministicRedis();
    let successfulCalls = 0;

    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        requireIdempotency(makeContext(redis), async () => {
          successfulCalls += 1;
        }).then(
          () => "accepted" as const,
          (error) => {
            const problem = (error as Error & { cause?: { status?: number; error_code?: string } }).cause;
            expect(problem).toMatchObject({
              status: 409,
              error_code: "IDEMPOTENT_REPLAY",
            });
            return "replay" as const;
          },
        ),
      ),
    );

    expect(successfulCalls).toBe(1);
    expect(results.filter((result) => result === "accepted")).toHaveLength(1);
    expect(results.filter((result) => result === "replay")).toHaveLength(9);
  });
});
