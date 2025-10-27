import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { SECURE_ACTION_OK_RESPONSE, createTokenReuseProblem } from "@lokaltreu/types";
import { secureActionHandler } from "./secureActionHandler.js";
import { resetReplayStoreForTests } from "../../security/tokens/replayStore.js";

vi.mock("../../audit/auditEvent.js", () => ({
  auditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../security/observability.js", () => ({
  emitSecurityMetric: vi.fn(),
}));

import { auditEvent } from "../../audit/auditEvent.js";
import { emitSecurityMetric } from "../../security/observability.js";

function createRequest(headers: Record<string, string>, options: { requestId?: string } = {}): Request {
  const req = {
    method: "POST",
    path: "/secure-action",
    header(name: string) {
      const key = name.toLowerCase();
      return headers[key] ?? headers[name] ?? "";
    },
  } as unknown as Request;

  if (options.requestId) {
    (req as unknown as { id: string }).id = options.requestId;
  }

  return req;
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

describe("secureActionHandler", () => {
  beforeEach(() => {
    resetReplayStoreForTests();
    vi.mocked(auditEvent).mockClear();
    vi.mocked(emitSecurityMetric).mockClear();
  });

  it("returns 200 and audit ok on first token use", async () => {
    const req = createRequest(
      {
        "x-device-jti": "first-token",
        "x-device-id": "device-ok",
      },
      { requestId: "req-1" }
    );
    const res = new MockResponse();

    await secureActionHandler(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.contentType).toBe("application/json");
    expect(res.body).toEqual(SECURE_ACTION_OK_RESPONSE);
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "secure_action.ok",
      })
    );
    expect(emitSecurityMetric).not.toHaveBeenCalled();
  });

  it("returns 429 with Problem+JSON and emits metric on replay", async () => {
    const headers = {
      "x-device-jti": "dup-token",
      "x-device-id": "device-replay",
    };
    const req = createRequest(headers, { requestId: "req-replay" });
    const res1 = new MockResponse();
    await secureActionHandler(req, res1 as unknown as Response);

    vi.mocked(auditEvent).mockClear();
    vi.mocked(emitSecurityMetric).mockClear();

    const res2 = new MockResponse();
    await secureActionHandler(req, res2 as unknown as Response);

    expect(res2.statusCode).toBe(429);
    expect(res2.contentType).toBe("application/problem+json");
    expect(res2.body).toEqual(createTokenReuseProblem());
    expect(emitSecurityMetric).toHaveBeenCalledWith({
      name: "rate_token_reuse",
      attributes: {
        tenantId: "unknown-tenant",
      },
    });
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "secure_action.blocked_replay",
      })
    );
  });
});
