import type { components, paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./api/fetch-with-timeout";
import { parseProblem as parseProblemBase } from "./api/problem";

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
  type: "about:blank",
  title: "Network error",
  status: 503,
  detail: "Service not reachable. Please try again.",
};

function toStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeProblem(input: unknown, fallbackStatus: number): Problem {
  const parsed = parseProblemBase(input, fallbackStatus);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const type = toStringField(raw.type) ?? "about:blank";
  const instance = toStringField(raw.instance);

  return {
    type,
    title: parsed.title,
    status: parsed.status,
    detail: parsed.detail,
    instance,
    error_code: parsed.error_code as Problem["error_code"],
    correlation_id: parsed.correlation_id,
    retry_after: parsed.retry_after,
  };
}

async function parseProblemResponse(res: Response): Promise<Problem> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/problem+json")) {
    try {
      const data = await res.json();
      return normalizeProblem(data, res.status);
    } catch {
      return normalizeProblem({ status: res.status }, res.status);
    }
  }

  return normalizeProblem(
    { status: res.status, title: res.statusText || "Request failed" },
    res.status,
  );
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
    if (err && typeof err === "object" && "status" in err && "title" in err && "type" in err) {
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
    if (err && typeof err === "object" && "status" in err && "title" in err && "type" in err) {
      throw err as Problem;
    }
    throw networkProblem;
  }
}
