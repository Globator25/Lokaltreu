import { describe, expect, it } from "vitest";
import { parseProblem, toUserMessage } from "./problem";

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
      status: 403,
      title: "Plan not allowed",
      error_code: "PLAN_NOT_ALLOWED",
      correlation_id: "support-999",
    });

    expect(message).toContain("Plan");
    expect(message).toContain("Support-Code: support-999");
  });

  it("returns fallback message when error_code is missing", () => {
    const message = toUserMessage({
      status: 500,
      title: "Server error",
    });

    expect(message).toContain("Fehler");
  });
});
