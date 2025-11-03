import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import { makeRequest } from "../../test-utils/http.js";
import { globalErrorHandler } from "./globalErrorHandler.js";

describe("globalErrorHandler", () => {
  it("logs correlation id without exposing raw IP and returns RFC7807 payload", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const status = vi.fn().mockReturnThis();
    const type = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();

    const req = makeRequest({
      method: "GET",
      path: "/foo",
      headers: {
        "x-correlation-id": "corr-987",
        "x-request-id": "req-123",
        "x-forwarded-for": "203.0.113.5",
        "user-agent": "should-not-log",
      },
    });

    const res = {
      status,
      type,
      json,
    } as unknown as Response;

    const next = (() => undefined) as NextFunction;

    globalErrorHandler(new Error("boom"), req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith("[unhandled-error]", {
      correlationId: "corr-987",
      path: "/foo",
      method: "GET",
      error: "boom",
    });
    const loggedPayload = consoleSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(JSON.stringify(loggedPayload)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(JSON.stringify(loggedPayload)).not.toContain("should-not-log");
    expect(status).toHaveBeenCalledWith(500);
    expect(type).toHaveBeenCalledWith("application/problem+json");
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        type: "https://errors.lokaltreu.example/internal",
        title: "INTERNAL_SERVER_ERROR",
        error_code: "INTERNAL_SERVER_ERROR",
        detail: "boom",
        correlation_id: "corr-987",
        requestId: "req-123",
      }),
    );

    consoleSpy.mockRestore();
  });
});
