import { describe, expect, it, vi } from "vitest";
import { createStampToken } from "./stamps";

vi.mock("../fetch-with-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

describe("createStampToken", () => {
  it("posts to staff stamps tokens with idempotency header", async () => {
    const { fetchWithTimeout } = await import("../fetch-with-timeout");
    const fetchMock = vi.mocked(fetchWithTimeout);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        qrToken: "qr-token",
        jti: "jti-1",
        expiresAt: "2026-01-24T10:00:00Z",
      }),
    } as unknown as Response);

    const result = await createStampToken({
      idempotencyKey: "idem-123",
      deviceKey: "device-key",
      deviceTimestamp: "1737686400",
      deviceProof: "proof",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.qrToken).toBe("qr-token");
    }

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/staff-api/stamps/tokens");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("idem-123");
    expect(headers["X-Device-Key"]).toBe("device-key");
    expect(headers["X-Device-Timestamp"]).toBe("1737686400");
    expect(headers["X-Device-Proof"]).toBe("proof");
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it("returns problem details on problem+json", async () => {
    const { fetchWithTimeout } = await import("../fetch-with-timeout");
    const fetchMock = vi.mocked(fetchWithTimeout);

    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: {
        get: () => "application/problem+json",
      },
      json: async () => ({
        status: 429,
        title: "Rate limited",
        error_code: "RATE_LIMITED",
      }),
    } as unknown as Response);

    const result = await createStampToken({
      idempotencyKey: "idem-456",
      deviceKey: "device-key",
      deviceTimestamp: "1737686400",
      deviceProof: "proof",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(429);
      expect(result.problem.error_code).toBe("RATE_LIMITED");
    }
  });
});
