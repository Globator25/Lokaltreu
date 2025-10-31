import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { globalErrorHandler } from "./globalErrorHandler.js";

describe("globalErrorHandler", () => {
  it("logs correlation id without exposing raw IP and returns RFC7807 payload", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const status = vi.fn().mockReturnThis();
    const type = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();

    const req = {
      id: "req-123",
      path: "/foo",
      method: "GET",
      headers: { "x-correlation-id": "corr-987", "user-agent": "should-not-log" },
    } as unknown as Request;

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
        requestId: "req-123",
      })
    );

    consoleSpy.mockRestore();
  });
});
