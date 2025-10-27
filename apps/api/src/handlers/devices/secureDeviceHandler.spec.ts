import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { SECURE_DEVICE_OK_RESPONSE } from "@lokaltreu/types";
import { secureDeviceHandler } from "./secureDeviceHandler.js";

vi.mock("../../audit/auditEvent.js", () => ({
  auditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../security/device/verifyDeviceProof.js", () => ({
  verifyDeviceProof: vi.fn(),
  rejectDeviceProof: vi.fn(),
}));

import { auditEvent } from "../../audit/auditEvent.js";
import { rejectDeviceProof, verifyDeviceProof } from "../../security/device/verifyDeviceProof.js";

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

describe("secureDeviceHandler", () => {
  beforeEach(() => {
    vi.mocked(auditEvent).mockClear();
    vi.mocked(verifyDeviceProof).mockReset();
    vi.mocked(rejectDeviceProof).mockReset();
  });

  it("responds with 200 and audit ok when device proof succeeds", async () => {
    const req = { id: "req-200" } as unknown as Request;
    const res = new MockResponse();

    vi.mocked(verifyDeviceProof).mockResolvedValue({
      ok: true,
      deviceId: "device-200",
    });

    await secureDeviceHandler(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.contentType).toBe("application/json");
    expect(res.body).toEqual(SECURE_DEVICE_OK_RESPONSE);
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "secure_device.attempt",
        meta: expect.objectContaining({ result: "ok" }),
      })
    );
    expect(rejectDeviceProof).not.toHaveBeenCalled();
  });

  it("delegates to rejectDeviceProof when validation fails", async () => {
    const req = { id: "req-403" } as unknown as Request;
    const res = new MockResponse();
    vi.mocked(verifyDeviceProof).mockResolvedValue({
      ok: false,
      reason: "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW",
      deviceId: "device-403",
    });

    await secureDeviceHandler(req, res as unknown as Response);

    expect(rejectDeviceProof).toHaveBeenCalledWith(res, "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW");
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ result: "failed" }),
      })
    );
  });
});
