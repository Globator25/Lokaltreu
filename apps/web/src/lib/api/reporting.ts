import type { paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { parseProblem, type Problem } from "./problem";

export type ReportingSummaryResponse =
  paths["/admins/reporting/summary"]["get"]["responses"]["200"]["content"]["application/json"];

export type ReportingTimeseriesResponse =
  paths["/admins/reporting/timeseries"]["get"]["responses"]["200"]["content"]["application/json"];

export type ReportingTimeseriesQuery =
  paths["/admins/reporting/timeseries"]["get"]["parameters"]["query"];

export type GetReportingSummaryResult =
  | { ok: true; data: ReportingSummaryResponse }
  | { ok: false; problem: Problem };

export type GetReportingTimeseriesResult =
  | { ok: true; data: ReportingTimeseriesResponse }
  | { ok: false; problem: Problem };

const baseUrl = "/api";
const timeoutMs = 8000;

const networkProblem: Problem = {
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

function toQueryString(params: ReportingTimeseriesQuery): string {
  const sp = new URLSearchParams();

  // metric + bucket sind required (laut OpenAPI)
  sp.set("metric", params.metric);
  sp.set("bucket", params.bucket);

  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);

  const qs = sp.toString();
  return qs.length > 0 ? `?${qs}` : "";
}

export async function getReportingSummary(): Promise<GetReportingSummaryResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/reporting/summary`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as ReportingSummaryResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}

export async function getReportingTimeseries(
  params: ReportingTimeseriesQuery,
): Promise<GetReportingTimeseriesResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/reporting/timeseries${toQueryString(params)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as ReportingTimeseriesResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
