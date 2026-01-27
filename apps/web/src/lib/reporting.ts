import type { components, paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./api/fetch-with-timeout";
import { defaultProblemType, parseProblem } from "./api/problem";

export type Summary200 =
  paths["/admins/reporting/summary"]["get"]["responses"]["200"]["content"]["application/json"];
export type TimeseriesQuery =
  paths["/admins/reporting/timeseries"]["get"]["parameters"]["query"];
export type Timeseries200 =
  paths["/admins/reporting/timeseries"]["get"]["responses"]["200"]["content"]["application/json"];
export type Problem = components["schemas"]["Problem"];

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const adminMockToken = process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN;
const timeoutMs = 8000;

const networkProblem: Problem = {
  type: defaultProblemType,
  title: "Network error",
  status: 503,
  detail: "Service not reachable. Please try again.",
};

function toStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function parseProblemResponse(res: Response): Promise<Problem> {
  try {
    const data = await res.json();
    const problem = parseProblem(data, res.status);
    const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const type = toStringField(raw.type) ?? defaultProblemType;
    const instance = toStringField(raw.instance);

    return {
      ...problem,
      type,
      ...(instance ? { instance } : {}),
    };
  } catch {
    return parseProblem(
      { type: defaultProblemType, status: res.status, title: res.statusText || "Request failed" },
      res.status,
    );
  }
}

function buildTimeseriesQuery(query: TimeseriesQuery): string {
  const params = new URLSearchParams();
  const metric = query.metric ?? "stamps";
  const bucket = query.bucket ?? "day";
  params.set("metric", metric);
  params.set("bucket", bucket);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params.toString();
}

function buildAuthHeaders(): HeadersInit | undefined {
  if (!adminMockToken) return undefined;
  return {
    Authorization: `Bearer ${adminMockToken}`,
  };
}

function buildRequestInit(): RequestInit {
  const headers = buildAuthHeaders();
  return headers ? { method: "GET", headers } : { method: "GET" };
}

export async function getAdminReportingSummary(): Promise<Summary200> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/reporting/summary`,
      buildRequestInit(),
      timeoutMs,
    );

    if (res.ok) {
      return (await res.json()) as Summary200;
    }

    throw await parseProblemResponse(res);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && "title" in err) {
      throw err as Problem;
    }
    throw networkProblem;
  }
}

export async function getAdminReportingTimeseries(
  query: TimeseriesQuery,
): Promise<Timeseries200> {
  const qs = buildTimeseriesQuery(query);

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/reporting/timeseries?${qs}`,
      buildRequestInit(),
      timeoutMs,
    );

    if (res.ok) {
      return (await res.json()) as Timeseries200;
    }

    throw await parseProblemResponse(res);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && "title" in err) {
      throw err as Problem;
    }
    throw networkProblem;
  }
}
