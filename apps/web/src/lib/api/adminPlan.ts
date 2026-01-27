import type { paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { defaultProblemType, parseProblem, type Problem } from "./problem";

export type AdminPlanResponse =
  paths["/admins/plan"]["get"]["responses"]["200"]["content"]["application/json"];

export type GetAdminPlanResult =
  | { ok: true; data: AdminPlanResponse }
  | { ok: false; problem: Problem };

const baseUrl = "/api";
const timeoutMs = 8000;
const adminMockToken = process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN;

const networkProblem: Problem = {
  type: defaultProblemType,
  status: 503,
  title: "Network error",
  detail: "Service not reachable. Please try again.",
};

async function parseProblemResponse(res: Response): Promise<Problem> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/problem+json")) {
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

function buildHeaders(): HeadersInit {
  if (!adminMockToken) {
    return { Accept: "application/json" };
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${adminMockToken}`,
  };
}

export async function getAdminPlan(): Promise<GetAdminPlanResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/plan`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as AdminPlanResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
