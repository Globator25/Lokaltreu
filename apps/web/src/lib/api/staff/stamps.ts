import type { paths } from "@lokaltreu/types";
import { defaultProblemType, type Problem } from "../problem";
import {
  buildBadRequestProblem,
  fetchStaffWithTimeout,
  parseProblemResponse,
  staffBaseUrl,
} from "./base";

export type StampTokenResponse =
  paths["/stamps/tokens"]["post"]["responses"]["201"]["content"]["application/json"];

export type CreateStampTokenResult =
  | { ok: true; data: StampTokenResponse }
  | { ok: false; problem: Problem };

const timeoutMs = 8000;

const networkProblem: Problem = {
  type: defaultProblemType,
  status: 503,
  title: "Service nicht erreichbar. Bitte Prism/Backend starten und erneut versuchen.",
  detail: "Network error",
};

export async function createStampToken(args: {
  idempotencyKey: string;
  deviceKey: string;
  deviceTimestamp: string;
  deviceProof: string;
}): Promise<CreateStampTokenResult> {
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

  try {
    const res = await fetchStaffWithTimeout(
      `${staffBaseUrl}/stamps/tokens`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": args.idempotencyKey,
          Accept: "application/json",
          "X-Device-Key": args.deviceKey,
          "X-Device-Timestamp": args.deviceTimestamp,
          "X-Device-Proof": args.deviceProof,
        },
      },
      timeoutMs,
    );

    if (res.ok) {
      const data = (await res.json()) as StampTokenResponse;
      return { ok: true, data };
    }

    const problem = await parseProblemResponse(res);
    return { ok: false, problem };
  } catch {
    return { ok: false, problem: networkProblem };
  }
}
