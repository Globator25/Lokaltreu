import type { paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { parseProblem, type Problem } from "./problem";

export type OfferCurrentResponse =
  paths["/admins/offers/current"]["get"]["responses"]["200"]["content"]["application/json"];

export type OfferUpsertRequest =
  paths["/admins/offers/current"]["put"]["requestBody"]["content"]["application/json"];

export type PutOfferResponse =
  paths["/admins/offers/current"]["put"]["responses"]["200"]["content"]["application/json"];

export type GetCurrentOfferResult =
  | { ok: true; data: OfferCurrentResponse }
  | { ok: false; problem: Problem };

export type PutCurrentOfferResult =
  | { ok: true; data: PutOfferResponse }
  | { ok: false; problem: Problem };

const baseUrl = "/api";
const timeoutMs = 8000;
const adminMockToken = process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN;

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

function buildHeaders(idempotencyKey?: string): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (adminMockToken) {
    headers.Authorization = `Bearer ${adminMockToken}`;
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return headers;
}

export async function getCurrentOffer(): Promise<GetCurrentOfferResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/offers/current`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as OfferCurrentResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}

export async function putCurrentOffer(
  payload: OfferUpsertRequest,
  idempotencyKey: string,
): Promise<PutCurrentOfferResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/admins/offers/current`,
      {
        method: "PUT",
        headers: {
          ...buildHeaders(idempotencyKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as PutOfferResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
