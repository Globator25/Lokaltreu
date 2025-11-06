import { TextDecoder } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

vi.mock("@noble/ed25519", () => ({
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("../observability.js", () => ({
  emitSecurityMetric: vi.fn(),
}));

import { verify } from "@noble/ed25519";
import { createDeviceProofProblem } from "../../runtime/contracts.js";
import { makeRequest } from "../../test-utils/http.js";
import { emitSecurityMetric } from "../observability.js";
import { registerDevicePublicKey, rejectDeviceProof, verifyDeviceProof } from "./verifyDeviceProof.js";

const createRequest = (headers: Record<string, string>) =>
  makeRequest({ method: "POST", path: "/secure-device", headers, ip: "127.0.0.1" });

function makeRes(): {
  res: Response;
  status: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  const type = vi.fn();
  const json = vi.fn();
  const res: Partial<Response> = {};
  res.status = ((code: number) => {
    status(code);
    return res as Response;
  }) as Response["status"];
  res.type = ((value: string) => {
    type(value);
    return res as Response;
  }) as Response["type"];
  res.json = ((payload: unknown) => {
    json(payload);
    return res as Response;
  }) as Response["json"];
  res.setHeader = vi.fn() as Response["setHeader"];
  res.getHeader = vi.fn() as Response["getHeader"];
  return { res: res as Response, status, type, json };
}

describe("verifyDeviceProof", () => {
  beforeEach(() => {
    vi.mocked(emitSecurityMetric).mockClear();
    vi.mocked(verify).mockReset();
    vi.mocked(verify).mockResolvedValue(true);
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

  it("rejects when timestamp header is not numeric", async () => {
    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 8).toString("base64"),
      "x-device-id": "device-nan",
      "x-device-timestamp": "not-a-number",
      "x-device-jti": "jti-nan",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("MISSING_HEADERS");
    expect(result.deviceId).toBe("device-nan");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "MISSING_HEADERS" },
    });
  });

  it("rejects when the device key is unknown", async () => {
    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 6).toString("base64"),
      "x-device-id": "device-unknown",
      "x-device-timestamp": Date.now().toString(),
      "x-device-jti": "jti-unknown",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("UNKNOWN_DEVICE");
    expect(result.deviceId).toBe("device-unknown");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "UNKNOWN_DEVICE" },
    });
  });

  it("rejects when the stored device key expired", async () => {
    const deviceId = "device-expired";
    const ttlMs = 15 * 60 * 1000;
    const baseline = Date.now();
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(baseline).mockImplementation(() => baseline + ttlMs + 1000);

    registerDevicePublicKey(deviceId, Buffer.alloc(32, 7).toString("base64"));

    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 7).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": (baseline + ttlMs + 1000).toString(),
      "x-device-jti": "jti-expired",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("UNKNOWN_DEVICE");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "UNKNOWN_DEVICE" },
    });

    nowSpy.mockRestore();
  });

  it("rejects when the signature length is invalid", async () => {
    const deviceId = "device-short-signature";
    registerDevicePublicKey(deviceId, Buffer.alloc(32, 11).toString("base64"));

    const req = createRequest({
      "x-device-proof": Buffer.alloc(16, 12).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": Date.now().toString(),
      "x-device-jti": "jti-short",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "INVALID_SIGNATURE" },
    });
  });

  it("records a metric when ed25519 verification throws", async () => {
    const deviceId = "device-throw";
    registerDevicePublicKey(deviceId, Buffer.alloc(32, 13).toString("base64"));
    vi.mocked(verify).mockImplementationOnce(async () => {
      throw new Error("broken");
    });

    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 13).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": Date.now().toString(),
      "x-device-jti": "jti-throw",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "deviceProofFailed",
      attributes: { reason: "INVALID_SIGNATURE" },
    });
  });

  it("falls back to the request id when jti header is missing", async () => {
    const deviceId = "device-jti-fallback";
    registerDevicePublicKey(deviceId, Buffer.alloc(32, 14).toString("base64"));
    const timestamp = Date.now().toString();
    let capturedMessage: Uint8Array | undefined;

    vi.mocked(verify).mockImplementationOnce(async (signature, message, key) => {
      void signature;
      void key;
      capturedMessage = message;
      return true;
    });

    const req = createRequest({
      "x-device-proof": Buffer.alloc(64, 14).toString("base64"),
      "x-device-id": deviceId,
      "x-device-timestamp": timestamp,
      "x-request-id": "req-fallback",
    });

    const result = await verifyDeviceProof(req);
    expect(result.ok).toBe(true);
    expect(result.deviceId).toBe(deviceId);
    expect(capturedMessage).toBeDefined();
    const decoded = new TextDecoder().decode(capturedMessage as Uint8Array);
    expect(decoded.endsWith("|req-fallback")).toBe(true);
    expect(emitSecurityMetric).not.toHaveBeenCalled();
  });
});

describe("rejectDeviceProof", () => {
  it("responds with Problem+JSON for time window violations", () => {
    const { res, status, type, json } = makeRes();
    const correlationId = "corr-123";
    rejectDeviceProof(res, "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW", correlationId);
    expect(status).toHaveBeenCalledWith(403);
    expect(type).toHaveBeenCalledWith("application/problem+json");
    expect(json).toHaveBeenCalledWith(
      createDeviceProofProblem("TIMESTAMP_OUTSIDE_ALLOWED_WINDOW", correlationId),
    );
  });
});



