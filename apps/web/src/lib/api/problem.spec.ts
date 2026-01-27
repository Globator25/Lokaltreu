import { describe, expect, it } from "vitest";
import {
  defaultProblemType,
  parseProblem,
  toUiProblemMessage,
  toUserMessage,
  type Problem,
} from "./problem";

describe("parseProblem", () => {
  it("normalizes known fields", () => {
    const problem = parseProblem({
      status: 429,
      title: "Rate limited",
      detail: "Too many requests",
      error_code: "RATE_LIMITED",
      correlation_id: "abc-123",
      retry_after: 30,
    });

    expect(problem.status).toBe(429);
    expect(problem.title).toBe("Rate limited");
    expect(problem.detail).toBe("Too many requests");
    expect(problem.error_code).toBe("RATE_LIMITED");
    expect(problem.correlation_id).toBe("abc-123");
    expect(problem.retry_after).toBe(30);
  });

  it("uses fallback status and default title", () => {
    const problem = parseProblem({ detail: "oops" }, 418);

    expect(problem.status).toBe(418);
    expect(problem.title).toBe("Request failed");
    expect(problem.detail).toBe("oops");
  });
});

describe("toUserMessage", () => {
  it("maps error codes and adds support code", () => {
    const message = toUserMessage({
      type: defaultProblemType,
      status: 403,
      title: "Plan not allowed",
      error_code: "PLAN_NOT_ALLOWED",
      correlation_id: "support-999",
    });

    expect(message.toLowerCase()).toContain("plan");
    expect(message).toContain("Support-Code: support-999");
  });

  it("returns fallback message when error_code is missing", () => {
    const message = toUserMessage({
      type: defaultProblemType,
      status: 500,
      title: "Server error",
    });

    expect(message.toLowerCase()).toContain("error");
  });
});

describe("toUiProblemMessage (Step 36)", () => {
  const exhaustiveErrorCodes = [
    "TOKEN_EXPIRED",
    "TOKEN_REUSE",
    "SELF_REFERRAL_BLOCKED",
    "REFERRAL_LIMIT_REACHED",
    "REFERRAL_TENANT_MISMATCH",
    "PLAN_NOT_ALLOWED",
    "RATE_LIMITED",
  ] as const;

  it.each(exhaustiveErrorCodes)("maps %s without leaking detail", (errorCode) => {
    const problem: Problem = {
      type: "https://errors.lokaltreu.test/problem",
      status: 400,
      title: "Problem title",
      error_code: errorCode,
      detail: "Sensitive internal detail",
    };

    const ui = toUiProblemMessage(problem);

    expect(ui.title.length).toBeGreaterThan(0);
    expect(ui.message.length).toBeGreaterThan(0);
    expect(ui.message).not.toContain("Sensitive internal detail");
  });

  it("propagates correlation_id as supportCode", () => {
    const problem: Problem = {
      type: "https://errors.lokaltreu.test/problem",
      status: 409,
      title: "Conflict",
      error_code: "TOKEN_REUSE",
      correlation_id: "support-abc",
    };

    const ui = toUiProblemMessage(problem);

    expect(ui.supportCode).toBe("support-abc");
  });

  it("uses retry_after for RATE_LIMITED", () => {
    const problem: Problem = {
      type: "https://errors.lokaltreu.test/problem",
      status: 429,
      title: "Rate limited",
      error_code: "RATE_LIMITED",
      retry_after: 27,
    };

    const ui = toUiProblemMessage(problem);

    expect(ui.retryAfterSeconds).toBe(27);
  });

  it("falls back to HTTP status when error_code is missing", () => {
    const problem: Problem = {
      type: "https://errors.lokaltreu.test/problem",
      status: 403,
      title: "Forbidden",
    };

    const ui = toUiProblemMessage(problem);

    expect(ui.title).toBe("Forbidden");
    expect(ui.message.length).toBeGreaterThan(0);
  });
});
