"use client";

import type { components, paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "../fetch-with-timeout";
import { parseProblem, type Problem } from "../problem";
import { getOrCreateTenantId } from "../../pwa-context";

export type DsrCreateResponse =
  paths["/dsr/requests"]["post"]["responses"]["201"]["content"]["application/json"];

export type DsrStatusResponse =
  paths["/dsr/requests/{dsr_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type DsrCreateRequest = components["schemas"]["DsrRequestCreateRequest"];

export type DsrApiResult<T> = { ok: true; data: T } | { ok: false; problem: Problem };

type CreateArgs = {
  cardId: string;
  requestType: DsrCreateRequest["requestType"];
  reason?: string;
  captchaToken?: string;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE ?? "";
const timeoutMs = 8000;

const networkProblem: Problem = {
  status: 503,
  title: "Network error",
  detail: "Service not reachable. Please try again.",
};

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base}${path.slice(1)}`;
  return `${base}${path}`;
}

function buildIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function parseProblemResponse(res: Response): Promise<Problem> {
  const contentType = res.headers.get("content-type") ?? "";
  const retryAfter = parseRetryAfter(res.headers.get("retry-after"));

  if (contentType.includes("application/problem+json")) {
    try {
      const data = await res.json();
      const problem = parseProblem(data, res.status);
      if (retryAfter && problem.retry_after === undefined) {
        return { ...problem, retry_after: retryAfter };
      }
      return problem;
    } catch {
      return parseProblem({ status: res.status, retry_after: retryAfter }, res.status);
    }
  }

  return parseProblem(
    { status: res.status, title: res.statusText || "Request failed", retry_after: retryAfter },
    res.status,
  );
}

function buildTenantHeader(): Record<string, string> {
  return { "x-tenant-id": getOrCreateTenantId() };
}

export async function createDsrRequest(args: CreateArgs): Promise<DsrApiResult<DsrCreateResponse>> {
  const payload: DsrCreateRequest = {
    requestType: args.requestType,
    subject: {
      subject_type: "card_id",
      subject_id: args.cardId,
    },
    ...(args.reason ? { reason: args.reason } : {}),
  };

  const headers: Record<string, string> = {
    ...buildTenantHeader(),
    "content-type": "application/json",
    "idempotency-key": buildIdempotencyKey(),
  };

  if (args.captchaToken) {
    headers["x-captcha-token"] = args.captchaToken;
  }

  try {
    const res = await fetchWithTimeout(
      joinUrl(baseUrl, "/dsr/requests"),
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as DsrCreateResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}

export async function getDsrRequest(dsrId: string): Promise<DsrApiResult<DsrStatusResponse>> {
  try {
    const res = await fetchWithTimeout(
      joinUrl(baseUrl, `/dsr/requests/${encodeURIComponent(dsrId)}`),
      {
        method: "GET",
        headers: buildTenantHeader(),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as DsrStatusResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
