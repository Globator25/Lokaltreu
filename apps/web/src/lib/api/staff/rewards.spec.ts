import { describe, expect, it, vi } from "vitest";
import { redeemReward } from "./rewards";

vi.mock("../fetch-with-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

describe("redeemReward", () => {
  it("posts to staff rewards redeem with device proof headers", async () => {
    const { fetchWithTimeout } = await import("../fetch-with-timeout");
    const fetchMock = vi.mocked(fetchWithTimeout);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        cardState: {
          currentStamps: 1,
          stampsRequired: 5,
          rewardsAvailable: 0,
        },
      }),
    } as Response);

    const result = await redeemReward({
      redeemToken: "redeem-123",
      idempotencyKey: "idem-789",
      deviceKey: "device-key",
      deviceTimestamp: "1737686400",
      deviceProof: "proof",
    });

    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/staff-api/rewards/redeem");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("idem-789");
    expect(headers["X-Device-Key"]).toBe("device-key");
    expect(headers["X-Device-Timestamp"]).toBe("1737686400");
    expect(headers["X-Device-Proof"]).toBe("proof");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns problem details on problem+json", async () => {
    const { fetchWithTimeout } = await import("../fetch-with-timeout");
    const fetchMock = vi.mocked(fetchWithTimeout);

    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: {
        get: () => "application/problem+json",
      },
      json: async () => ({
        status: 400,
        title: "Token expired",
        error_code: "TOKEN_EXPIRED",
      }),
    } as unknown as Response);

    const result = await redeemReward({
      redeemToken: "redeem-456",
      idempotencyKey: "idem-101",
      deviceKey: "device-key",
      deviceTimestamp: "1737686400",
      deviceProof: "proof",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(400);
      expect(result.problem.error_code).toBe("TOKEN_EXPIRED");
    }
  });
});
