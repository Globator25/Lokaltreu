import type { paths, components } from "@lokaltreu/types";
import { fetchWithTimeout } from "./fetch-with-timeout";

export type RegisterAdminRequest =
  paths["/admins/register"]["post"]["requestBody"]["content"]["application/json"];
export type RegisterAdmin201 =
  paths["/admins/register"]["post"]["responses"]["201"]["content"]["application/json"];
export type Problem = components["schemas"]["Problem"];

export type RegisterAdminResult =
  | { ok: true; data: RegisterAdmin201 }
  | { ok: false; problem: Problem };

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const timeoutMs = 8000;

const networkProblem: Problem = {
  type: "about:blank",
  title: "Network error",
  status: 503,
  detail: "Service not reachable. Please try again.",
};

async function parseProblem(res: Response): Promise<Problem> {
  try {
    const data = (await res.json()) as Problem;
    if (data && typeof data.title === "string" && typeof data.status === "number") {
      return data;
    }
  } catch {
    // Ignore parsing errors and fallback to a generic problem.
  }
  return {
    type: "about:blank",
    title: "Request failed",
    status: res.status,
    detail: "The request could not be completed.",
  };
}

export async function registerAdmin(
  req: RegisterAdminRequest,
): Promise<RegisterAdminResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as RegisterAdmin201;
      return { ok: true, data };
    }

    const problem = await parseProblem(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
