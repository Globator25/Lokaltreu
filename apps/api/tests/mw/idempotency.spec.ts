import { describe, expect, it, vi } from "vitest";
import { requireIdempotency, type IdempotencyContext } from "../../src/mw/idempotency.js";
import { problem } from "../../src/lib/problem.js";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Idempotency-Key": "REPLAY-KEY",
} as const;

class StubRedis {
  private readonly store = new Map<string, number>();
  private now = Date.now();

  advance(ms: number): void {
    this.now += ms;
  }

  async set(key: string, _value: string, options: { nx: true; ex: number }): Promise<"OK" | null> {
    const existing = this.store.get(key);
    if (existing && existing > this.now) {
      return null;
    }
    this.store.set(key, this.now + options.ex * 1000);
    return "OK";
  }
}

function makeContext({
  redis = new StubRedis(),
  headers,
  rawBody,
}: {
  redis?: StubRedis;
  headers?: Record<string, string>;
  rawBody?: string;
} = {}): IdempotencyContext {
  const body = rawBody ?? JSON.stringify({ qrToken: "demo" });
  const headerRecord = headers ?? { ...DEFAULT_HEADERS };
  const request = new Request("https://lokaltreu.test/stamps/claim", {
    method: "POST",
    headers: new Headers(headerRecord),
    body,
});


  return {
    request,
    tenantId: "tenant-123",
    route: "stamps.claim",
    redis: redis as unknown as IdempotencyContext["redis"],
    rawBody: body,
  };
}

describe("requireIdempotency", () => {
  it("allows exactly one of ten concurrent calls and rejects the rest with replay problems", async () => {
    const redis = new StubRedis();
    const next = vi.fn();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(() => requireIdempotency(makeContext({ redis }), next)),
    );

    const fulfilled = results.filter((result): result is PromiseFulfilledResult<void> => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveLength(9);

    for (const { reason } of rejected) {
      const cause = (reason as Error & { cause?: { status?: number; error_code?: string } }).cause;
      expect(cause).toMatchObject({
        status: 409,
        error_code: "IDEMPOTENT_REPLAY",
      });
    }
  });

  it("throws a 400 problem when the Idempotency-Key header is missing", async () => {
    const context = makeContext({ headers: {} });
    await expect(requireIdempotency(context, vi.fn())).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 400,
        error_code: "HEADERS_MISSING",
        type: "https://errors.lokaltreu.example/headers/missing-idempotency",
      }),
    });
  });

  it("allows a new call once the TTL window has expired", async () => {
    const stub = new StubRedis();
    const redis = stub;
    const next = vi.fn();

    await requireIdempotency(makeContext({ redis }), next);
    expect(next).toHaveBeenCalledTimes(1);

    stub.advance(24 * 60 * 60 * 1000 + 1);
    await requireIdempotency(makeContext({ redis }), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("propagates a 503 problem when the Redis backend fails", async () => {
    const failingRedis = {
      async set() {
        throw problem({
          status: 503,
          error_code: "IDEMPOTENCY_UNAVAILABLE",
          type: "https://errors.lokaltreu.example/idempotency/unavailable",
          title: "Idempotency cache unavailable",
        });
      },
    } as unknown as IdempotencyContext["redis"];

    const context = makeContext({ redis: failingRedis as unknown as StubRedis });

    await expect(requireIdempotency(context, vi.fn())).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 503,
        error_code: "IDEMPOTENCY_UNAVAILABLE",
      }),
    });
  });
});
