import type { paths } from "@lokaltreu/types";
import type { Problem } from "../problem";
import {
  buildBadRequestProblem,
  fetchStaffWithTimeout,
  parseProblemResponse,
  staffBaseUrl,
} from "./base";

export type RedeemRewardRequest =
  paths["/rewards/redeem"]["post"]["requestBody"]["content"]["application/json"];

export type RedeemResponse =
  paths["/rewards/redeem"]["post"]["responses"]["200"]["content"]["application/json"];

export type RedeemRewardResult =
  | { ok: true; data: RedeemResponse }
  | { ok: false; problem: Problem };

const timeoutMs = 8000;

const networkProblem: Problem = {
  status: 503,
  title: "Network error",
  detail: "Service not reachable. Please try again.",
};

export async function redeemReward(args: {
  redeemToken: string;
  idempotencyKey: string;
  deviceKey: string;
  deviceTimestamp: string;
  deviceProof: string;
}): Promise<RedeemRewardResult> {
  if (!args.redeemToken || args.redeemToken.trim().length === 0) {
    return {
      ok: false,
      problem: buildBadRequestProblem("Missing redeem token."),
    };
  }
  if (!args.idempotencyKey || args.idempotencyKey.trim().length === 0) {
    return {
      ok: false,
      problem: buildBadRequestProblem("Missing Idempotency-Key."),
    };
  }
  if (!args.deviceKey || args.deviceKey.trim().length === 0) {
    return {
      ok: false,
      problem: buildBadRequestProblem("Missing device key."),
    };
  }
  if (!args.deviceTimestamp || args.deviceTimestamp.trim().length === 0) {
    return {
      ok: false,
      problem: buildBadRequestProblem("Missing device timestamp."),
    };
  }
  if (!args.deviceProof || args.deviceProof.trim().length === 0) {
    return {
      ok: false,
      problem: buildBadRequestProblem("Missing device proof."),
    };
  }

  const payload: RedeemRewardRequest = { redeemToken: args.redeemToken };

  try {
    const res = await fetchStaffWithTimeout(
      `${staffBaseUrl}/rewards/redeem`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": args.idempotencyKey,
          "Content-Type": "application/json",
          "X-Device-Key": args.deviceKey,
          "X-Device-Timestamp": args.deviceTimestamp,
          "X-Device-Proof": args.deviceProof,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as RedeemResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
