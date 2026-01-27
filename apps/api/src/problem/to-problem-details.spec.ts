import { describe, expect, it } from "vitest";
import type { ProblemDetails } from "../handlers/http-utils.js";
import { isProblemDetails, toProblemDetails } from "./to-problem-details.js";

describe("isProblemDetails", () => {
  it("returns true for a valid ProblemDetails shape", () => {
    const value: ProblemDetails = {
      type: "https://errors.lokaltreu.example/request",
      title: "Bad Request",
      status: 400,
      detail: "Invalid input",
    };

    expect(isProblemDetails(value)).toBe(true);
  });

  it("returns false for null, array, and invalid field types", () => {
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails([])).toBe(false);
    expect(
      isProblemDetails({ type: 123, title: "Bad Request", status: "400" }),
    ).toBe(false);
  });
});

describe("toProblemDetails", () => {
  const fallback: ProblemDetails = {
    type: "https://errors.lokaltreu.example/request",
    title: "Internal Server Error",
    status: 500,
    detail: "Unexpected error",
  };

  it("returns the same instance when error is already ProblemDetails", () => {
    const problem: ProblemDetails = {
      type: "https://errors.lokaltreu.example/request",
      title: "Bad Request",
      status: 400,
      detail: "Invalid input",
    };

    const result = toProblemDetails(problem, fallback);
    expect(result).toBe(problem);
  });

  it("returns fallback with unchanged detail for Error instances", () => {
    const result = toProblemDetails(new Error("boom"), fallback);
    expect(result).toMatchObject({
      type: fallback.type,
      title: fallback.title,
      status: fallback.status,
      detail: fallback.detail,
    });
  });

  it("returns fallback unchanged for primitive or unknown values", () => {
    const result = toProblemDetails("oops", fallback);
    expect(result).toBe(fallback);
  });
});
