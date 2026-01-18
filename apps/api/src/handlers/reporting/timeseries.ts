import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { problem, problemFromError, sendJson, sendProblem } from "../http-utils.js";
import type {
  ReportingBucketSize,
  ReportingMetric,
  createReportingService,
} from "../../modules/reporting/reporting.service.js";

type ReportingService = ReturnType<typeof createReportingService>;

const METRICS: ReportingMetric[] = [
  "stamps",
  "rewards",
  "referral_links",
  "referral_qualified",
  "referral_bonus_stamps",
];

const BUCKETS: ReportingBucketSize[] = ["day", "week", "month"];

function isMetric(value: string | null): value is ReportingMetric {
  return value != null && METRICS.includes(value as ReportingMetric);
}

function isBucket(value: string | null): value is ReportingBucketSize {
  return value != null && BUCKETS.includes(value as ReportingBucketSize);
}

function parseDate(value: string | null): { date: Date | null; invalid: boolean } {
  if (!value) {
    return { date: null, invalid: false };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: null, invalid: true };
  }
  return { date: parsed, invalid: false };
}

export async function handleReportingTimeseries(
  req: AdminAuthRequest,
  res: ServerResponse,
  deps: { service: ReportingService },
) {
  const adminContext = req.context?.admin;
  if (!adminContext) {
    return sendProblem(
      res,
      problem(403, "Forbidden", "Missing admin context", req.url ?? "/admins/reporting/timeseries"),
    );
  }

  const url = new URL(req.url ?? "/admins/reporting/timeseries", "http://localhost");
  const metricParam = url.searchParams.get("metric");
  if (!isMetric(metricParam)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid metric", req.url ?? "/admins/reporting/timeseries"),
    );
  }

  const bucketParam = url.searchParams.get("bucket");
  if (!isBucket(bucketParam)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid bucket", req.url ?? "/admins/reporting/timeseries"),
    );
  }

  const now = new Date();
  const fromResult = parseDate(url.searchParams.get("from"));
  if (fromResult.invalid) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid from", req.url ?? "/admins/reporting/timeseries"),
    );
  }
  const toResult = parseDate(url.searchParams.get("to"));
  if (toResult.invalid) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid to", req.url ?? "/admins/reporting/timeseries"),
    );
  }
  const from = fromResult.date ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = toResult.date ?? now;

  if (from.getTime() >= to.getTime()) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid date range", req.url ?? "/admins/reporting/timeseries"),
    );
  }

  try {
    const payload = await deps.service.getTimeseries({
      tenantId: adminContext.tenantId,
      metric: metricParam,
      bucket: bucketParam,
      from,
      to,
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    const payload = problemFromError({
      error,
      instance: req.url ?? "/admins/reporting/timeseries",
    });
    return sendProblem(res, payload);
  }
}
