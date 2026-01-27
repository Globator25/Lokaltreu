import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import type { DeviceAuthRequest } from "../../middleware/device-auth.js";
import { handleStampTokens } from "./tokens.js";

function makeRes() {
  const headers = new Map<string, string>();
  let body = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | string[]) {
      headers.set(name, Array.isArray(value) ? value.join(",") : String(value));
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        body += chunk.toString();
      }
    },
  } as unknown as ServerResponse;

  return {
    res,
    headers,
    getBody: () => body,
  };
}

type StampTokenRequest = AdminAuthRequest & DeviceAuthRequest;

describe("handleStampTokens", () => {
  it("returns 400 Problem+JSON when idempotency key is missing", async () => {
    const deps = {
      service: { createToken: vi.fn() },
    };

    const req = {
      headers: {},
      url: "/stamps/tokens",
      context: { device: { tenantId: "tenant-1", deviceId: "device-1" } },
    } as StampTokenRequest;

    const { res, headers, getBody } = makeRes();

    await handleStampTokens(req, res, deps);

    expect(res.statusCode).toBe(400);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 400,
      title: "Bad Request",
      detail: "Idempotency-Key header is required",
      instance: "/stamps/tokens",
    });
  });

  it("returns 403 Problem+JSON when tenant context is missing", async () => {
    const deps = {
      service: { createToken: vi.fn() },
    };

    const req = {
      headers: { "idempotency-key": "idem-12345678" },
      url: "/stamps/tokens",
      context: {},
    } as StampTokenRequest;

    const { res, headers, getBody } = makeRes();

    await handleStampTokens(req, res, deps);

    expect(res.statusCode).toBe(403);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 403,
      title: "Forbidden",
      detail: "Missing tenant context",
      instance: "/stamps/tokens",
    });
  });

  it("returns 201 with token payload", async () => {
    const deps = {
      service: {
        createToken: vi.fn(async () => ({
          qrToken: "qr-123",
          jti: "jti-123",
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
      },
    };

    const req = {
      headers: { "idempotency-key": "idem-12345678" },
      url: "/stamps/tokens",
      context: { device: { tenantId: "tenant-1", deviceId: "device-1" } },
    } as StampTokenRequest;

    const { res, headers, getBody } = makeRes();

    await handleStampTokens(req, res, deps);

    expect(res.statusCode).toBe(201);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Idempotency-Key")).toBe("idem-12345678");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      qrToken: "qr-123",
      jti: "jti-123",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns 500 Problem+JSON when service throws", async () => {
    const deps = {
      service: {
        createToken: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
      logger: { error: vi.fn() },
    };

    const req = {
      headers: { "idempotency-key": "idem-12345678" },
      url: "/stamps/tokens",
      context: { device: { tenantId: "tenant-1", deviceId: "device-1" } },
    } as StampTokenRequest;

    const { res, headers, getBody } = makeRes();

    await handleStampTokens(req, res, deps);

    expect(res.statusCode).toBe(500);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 500,
      title: "Internal Server Error",
      detail: "boom",
      instance: "/stamps/tokens",
    });
  });
});
