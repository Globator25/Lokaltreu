import type { ProblemDetails } from "../handlers/http-utils.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "number"
  );
}

export function toProblemDetails(error: unknown, fallback: ProblemDetails): ProblemDetails {
  if (isProblemDetails(error)) {
    return error;
  }
  if (error instanceof Error) {
    const detail = fallback.detail;
    return {
      ...fallback,
      detail,
    };
  }
  return fallback;
}
