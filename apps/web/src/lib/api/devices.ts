import type { paths } from "@lokaltreu/types";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { defaultProblemType, parseProblem, type Problem } from "./problem";

export type CreateDeviceRegistrationLinkResponse =
  paths["/devices/registration-links"]["post"]["responses"]["201"]["content"]["application/json"];
export type ConfirmDeviceRegistrationRequest =
  paths["/devices/register/confirm"]["post"]["requestBody"]["content"]["application/json"];

export type CreateDeviceRegistrationLinkResult =
  | { ok: true; data: CreateDeviceRegistrationLinkResponse }
  | { ok: false; problem: Problem };

export type ConfirmDeviceRegistrationResult =
  | { ok: true }
  | { ok: false; problem: Problem };

const baseUrl = "/api";
const timeoutMs = 8000;

const networkProblem: Problem = {
  type: defaultProblemType,
  status: 503,
  title: "Network error",
  detail: "Service not reachable. Please try again.",
};

function buildIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

export async function createDeviceRegistrationLink(): Promise<CreateDeviceRegistrationLinkResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/devices/registration-links`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": buildIdempotencyKey(),
        },
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as CreateDeviceRegistrationLinkResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}

export async function confirmDeviceRegistration(
  token: ConfirmDeviceRegistrationRequest["token"],
): Promise<ConfirmDeviceRegistrationResult> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/devices/register/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": buildIdempotencyKey(),
        },
        body: JSON.stringify({ token }),
      },
      timeoutMs,
    );

    if (res.status === 204) {
      return { ok: true };
    }

    if (res.ok) {
      return { ok: true };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
