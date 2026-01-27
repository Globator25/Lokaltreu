"use client";

import type { paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./api/fetch-with-timeout";
import { defaultProblemType, parseProblem, type Problem } from "./api/problem";
import { getOrCreateCardId, getOrCreateTenantId } from "./pwa-context";

export type ReferralLinkResponse =
  paths["/referrals/link"]["get"]["responses"]["200"]["content"]["application/json"];

export type ClaimStampResponse =
  paths["/stamps/claim"]["post"]["responses"]["200"]["content"]["application/json"];

export type PwaApiResult<T> = { ok: true; data: T } | { ok: false; problem: Problem };

const baseUrl = process.env.NEXT_PUBLIC_API_BASE ?? "";
const timeoutMs = 8000;

const networkProblem: Problem = {
  type: defaultProblemType,
  title: "Network error",
  status: 503,
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

export function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    "x-tenant-id": getOrCreateTenantId(),
    "x-card-id": getOrCreateCardId(),
  };

  return { ...base, ...(extra ?? {}) };
}

async function parseProblemResponse(res: Response): Promise<Problem> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/problem+json")) {
    try {
      const data = await res.json();
      return parseProblem(data, res.status);
    } catch {
      return parseProblem({ status: res.status, title: res.statusText || "Request failed" }, res.status);
    }
  }

  return parseProblem({ status: res.status, title: res.statusText || "Request failed" }, res.status);
}

export async function getReferralLink(): Promise<PwaApiResult<ReferralLinkResponse>> {
  try {
    const res = await fetchWithTimeout(
      joinUrl(baseUrl, "/referrals/link"),
      {
        method: "GET",
        headers: buildHeaders(),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as ReferralLinkResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}

export async function claimStamp(qrToken: string): Promise<PwaApiResult<ClaimStampResponse>> {
  try {
    const res = await fetchWithTimeout(
      joinUrl(baseUrl, "/stamps/claim"),
      {
        method: "POST",
        headers: buildHeaders({
          "content-type": "application/json",
          "idempotency-key": buildIdempotencyKey(),
        }),
        body: JSON.stringify({ qrToken }),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as ClaimStampResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
