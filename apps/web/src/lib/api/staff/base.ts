import { fetchWithTimeout } from "../fetch-with-timeout";
import { defaultProblemType, parseProblem, type Problem } from "../problem";

export const staffBaseUrl = "/staff-api";

export function buildIdempotencyKey(prefix = "idem"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isProblemJson(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/problem+json");
}

export function buildBadRequestProblem(detail: string): Problem {
  return {
    type: defaultProblemType,
    status: 400,
    title: "Bad Request",
    detail,
  };
}

export async function parseProblemResponse(res: Response): Promise<Problem> {
  if (isProblemJson(res)) {
    try {
      const data = await res.json();
      return parseProblem(data, res.status);
    } catch {
      return parseProblem({ status: res.status }, res.status);
    }
  }

  return parseProblem(
    { status: res.status, title: res.statusText || "Request failed" },
    res.status,
  );
}

export async function fetchStaffWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetchWithTimeout(input, init, timeoutMs);
}
