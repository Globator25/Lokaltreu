import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@noble/ed25519", () => ({
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("../observability.js", () => ({
  emitSecurityMetric: vi.fn(),
}));

import { verify } from "@noble/ed25519";
import { emitSecurityMetric } from "../observability.js";
import { registerDevicePublicKey, rejectDeviceProof, verifyDeviceProof } from "./verifyDeviceProof.js";

function createRequest(headers: Record<string, string>, overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    path: "/secure-device",
    get(name: string) {
      const key = name.toLowerCase();
      const value = headers[key] ?? headers[name];
      return value ?? "";
    },
    ...overrides,
  } as Request;
}

class MockResponse implements Partial<Response> {
  statusCode = 0;
  contentType?: string;
  body: unknown;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  type(value: string): this {
    this.contentType = value;
    return this;
  }

  json(payload: unknown): this {
    this.body = payload;
    return this;
  }
}

describe("verifyDeviceProof", () => {
  beforeEach(() => {
    vi.mocked(emitSecurityMetric).mockClear();
  });

  it("accepts a valid device proof within the ±60s window", async () => {
    const deviceId = "device-123";
    registerDevicePublicKey(deviceId, Buffer.alloc(32, 3).toString("base64"));

    const timestamp = Date.now().toString();
    const jti = "jti-ok";

    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 5).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": timestamp,
      "x-device-jti": jti,
    });

    vi.mocked(verify).mockResolvedValueOnce(true);

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(true);
    expect(result.deviceId).toBe(deviceId);
    expect(vi.mocked(emitSecurityMetric)).not.toHaveBeenCalled();
  });

  it("rejects proof when timestamp is outside ±60s and emits metric", async () => {
    const deviceId = "device-time-skew";
    registerDevicePublicKey(deviceId, Buffer.alloc(32, 1).toString("base64"));
    const oldTimestamp = (Date.now() - 120_000).toString();
    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 2).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": oldTimestamp,
      "x-device-jti": "jti-late",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("TIMESTAMP_OUTSIDE_ALLOWED_WINDOW");
    expect(vi.mocked(emitSecurityMetric)).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: {
        reason: "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW",
      },
    });
  });

  it("rejects when headers are missing", async () => {
    const req = createRequest({});
    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("MISSING_HEADERS");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "MISSING_HEADERS" },
    });
  });

  it("rejects invalid signatures", async () => {
    registerDevicePublicKey("device-invalid", Buffer.alloc(32, 9).toString("base64"));
    vi.mocked(verify).mockResolvedValueOnce(false);
    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 9).toString("base64"),
      "x-device-id": "device-invalid",
      "x-device-timestamp": Date.now().toString(),
      "x-device-jti": "jti-invalid",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "INVALID_SIGNATURE" },
    });
  });
});

describe("rejectDeviceProof", () => {
  it("responds with Problem+JSON for time window violations", () => {
    const res = new MockResponse();
    rejectDeviceProof(res as unknown as Response, "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW");
    expect(res.statusCode).toBe(403);
    expect(res.contentType).toBe("application/problem+json");
    expect(res.body).toMatchObject({
      title: "DEVICE_PROOF_INVALID_TIME",
      status: 403,
      detail: "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW",
    });
  });
});
