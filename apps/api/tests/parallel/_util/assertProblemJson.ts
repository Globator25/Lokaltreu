import { expect } from "vitest";

type ProblemShape = {
  status?: unknown;
  error_code?: unknown;
};

export function assertProblemJson(contentType: string | null, json: ProblemShape): void {
  expect(contentType ?? "").toContain("application/problem+json");
  expect(typeof json.status).toBe("number");
  if (typeof json.error_code !== "undefined") {
    expect(typeof json.error_code).toBe("string");
  }
}
