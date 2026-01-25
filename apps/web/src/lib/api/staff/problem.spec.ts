import { describe, expect, it } from "vitest";
import { toStaffUserMessage } from "./problem";

describe("toStaffUserMessage", () => {
  it("maps TOKEN_EXPIRED", () => {
    const message = toStaffUserMessage({
      status: 400,
      title: "Token expired",
      error_code: "TOKEN_EXPIRED",
    });

    expect(message).toContain("abgelaufen");
  });

  it("maps TOKEN_REUSE", () => {
    const message = toStaffUserMessage({
      status: 409,
      title: "Token reuse",
      error_code: "TOKEN_REUSE",
    });

    expect(message).toContain("bereits verwendet");
  });

  it("maps PLAN_NOT_ALLOWED", () => {
    const message = toStaffUserMessage({
      status: 403,
      title: "Plan not allowed",
      error_code: "PLAN_NOT_ALLOWED",
    });

    expect(message).toContain("Plan");
  });

  it("maps RATE_LIMITED with retry_after", () => {
    const message = toStaffUserMessage({
      status: 429,
      title: "Rate limited",
      error_code: "RATE_LIMITED",
      retry_after: 12,
    });

    expect(message).toContain("12s");
  });

  it("appends correlation_id", () => {
    const message = toStaffUserMessage({
      status: 409,
      title: "Conflict",
      error_code: "TOKEN_REUSE",
      correlation_id: "support-123",
    });

    expect(message).toContain("Support-Code: support-123");
  });

  it("falls back to title for unknown codes", () => {
    const message = toStaffUserMessage({
      status: 500,
      title: "Unknown error",
      error_code: "SOME_UNKNOWN_CODE",
    });

    expect(message).toContain("Unknown error");
  });
});
