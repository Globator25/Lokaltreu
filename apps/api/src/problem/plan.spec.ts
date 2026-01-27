import { describe, expect, it } from "vitest";
import {
  PLAN_NOT_ALLOWED_CODE,
  PLAN_NOT_ALLOWED_ERROR,
  PLAN_NOT_ALLOWED_TITLE,
  PLAN_NOT_ALLOWED_TYPE,
  isPlanNotAllowedError,
  makePlanNotAllowedProblem,
} from "./plan.js";

describe("problem/plan", () => {
  it("exports deterministic constants", () => {
    expect(PLAN_NOT_ALLOWED_TYPE).toBe("https://errors.lokaltreu.example/plan/not-allowed");
    expect(PLAN_NOT_ALLOWED_TITLE).toBe("Plan not allowed");
    expect(PLAN_NOT_ALLOWED_CODE).toBe("PLAN_NOT_ALLOWED");
    expect(PLAN_NOT_ALLOWED_ERROR).toBe("PLAN_NOT_ALLOWED");
  });

  it("isPlanNotAllowedError matches only the expected error message", () => {
    expect(isPlanNotAllowedError(new Error(PLAN_NOT_ALLOWED_ERROR))).toBe(true);
    expect(isPlanNotAllowedError(new Error("OTHER"))).toBe(false);
    expect(isPlanNotAllowedError({ message: PLAN_NOT_ALLOWED_ERROR })).toBe(false);
    expect(isPlanNotAllowedError(null)).toBe(false);
  });

  it("makePlanNotAllowedProblem builds a complete RFC7807-like problem", () => {
    const problem = makePlanNotAllowedProblem({
      correlationId: "corr-123",
      detail: "Upgrade required",
      instance: "/referrals/link",
    });

    expect(problem).toEqual({
      type: PLAN_NOT_ALLOWED_TYPE,
      title: PLAN_NOT_ALLOWED_TITLE,
      status: 403,
      detail: "Upgrade required",
      instance: "/referrals/link",
      error_code: PLAN_NOT_ALLOWED_CODE,
      correlation_id: "corr-123",
    });
  });

  it("makePlanNotAllowedProblem keeps detail/instance undefined when omitted", () => {
    const problem = makePlanNotAllowedProblem({ correlationId: "corr-456" });

    expect(problem.status).toBe(403);
    expect(problem.detail).toBeUndefined();
    expect(problem.instance).toBeUndefined();
    expect(problem.correlation_id).toBe("corr-456");
  });
});
