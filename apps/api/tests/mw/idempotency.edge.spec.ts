import { describe, expect, it, vi } from "vitest";
import { requireIdempotency, type IdempotencyContext } from "../../src/mw/idempotency.js";

const baseUrl = "https://lokaltreu.test/stamps/claim";

const makeContext = (overrides: Partial<IdempotencyContext> = {}): IdempotencyContext => {
  const method = overrides.request instanceof Request ? overrides.request.method : overrides.request?.method ?? "POST";
  const headers =
    overrides.request instanceof Request
      ? overrides.request.headers
      : new Headers(
          overrides.request?.headers ??
            {
              "Content-Type": "application/json",
              "Idempotency-Key": "edge-key",
            },
        );
  const body =
    overrides.rawBody ??
    JSON.stringify({
      qrToken: "edge-token",
    });

  const request =
    overrides.request instanceof Request
      ? overrides.request
      : new Request(baseUrl, {
          method,
          headers,
          body,
        });

  return {
    request,
    tenantId: overrides.tenantId ?? "tenant-edge",
    route: overrides.route ?? "stamps.claim",
    rawBody: body,
    redis: overrides.redis,
  };
};

describe("requireIdempotency edge cases", () => {
  it("returns a 400 problem when the Idempotency-Key header is empty", async () => {
    const context = makeContext({
      request: new Request(baseUrl, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          "Idempotency-Key": "   ",
        }),
        body: JSON.stringify({ qrToken: "edge-empty" }),
      }),
    });

    await expect(requireIdempotency(context, vi.fn())).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 400,
        error_code: "HEADERS_MISSING",
      }),
    });
  });

  it("simply proceeds when the request method is GET", async () => {
    const next = vi.fn();
    const getRequest = new Request(baseUrl, {
      method: "GET",
      headers: new Headers({
        "Idempotency-Key": "edge-get",
      }),
    });
    const context = makeContext({ request: getRequest });

    await requireIdempotency(context, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((context as { response?: Response }).response).toBeUndefined();
  });

  it("propagates a 409 when the store indicates the key already exists (TTL exhausted)", async () => {
    const redis = {
      set: vi.fn(async (_key: string, _value: string, options: { nx: true; ex: number }) => {
        expect(options.ex).toBeGreaterThan(0);
        return null;
      }),
    };

    const context = makeContext({ redis: redis as unknown as IdempotencyContext["redis"] });

    await expect(requireIdempotency(context, vi.fn())).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 409,
        error_code: "IDEMPOTENT_REPLAY",
      }),
    });
  });
});
