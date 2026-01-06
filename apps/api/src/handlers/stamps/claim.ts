import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, readJsonBody, sendJson, sendProblem } from "../http-utils.js";
import {
  StampTokenExpiredError,
  StampTokenReuseError,
  type StampService,
} from "../../modules/stamps/stamp.service.js";
import {
  PlanNotAllowedError,
  ReferralLimitReachedError,
  ReferralTenantMismatchError,
  SelfReferralBlockedError,
} from "../../services/referrals.service.js";

type StampClaimDeps = {
  service: StampService;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

type StampClaimRequest = IncomingMessage & {
  body?: unknown;
  context?: { cardId?: string };
};

function readCardId(req: StampClaimRequest): string {
  const fromContext = req.context?.cardId;
  if (typeof fromContext === "string" && fromContext.trim()) {
    return fromContext.trim();
  }
  return "card-anon";
}

export async function handleStampClaim(
  req: StampClaimRequest,
  res: ServerResponse,
  deps: StampClaimDeps,
) {
  const body = req.body ?? (await readJsonBody(req));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/stamps/claim"),
    );
  }

  const qrToken = (body as Record<string, unknown>)["qrToken"];
  if (typeof qrToken !== "string") {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Missing qrToken", req.url ?? "/stamps/claim"),
    );
  }

  const refValue = (body as Record<string, unknown>)["ref"];
  const ref = typeof refValue === "string" ? refValue : refValue == null ? null : undefined;
  if (ref === undefined) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid ref", req.url ?? "/stamps/claim"),
    );
  }

  try {
    const cardId = readCardId(req);
    const payload = await deps.service.claimStamp({
      qrToken,
      ref,
      cardId,
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    if (error instanceof StampTokenExpiredError) {
      return sendProblem(
        res,
        problem(400, "Token expired", error.message, req.url ?? "/stamps/claim", "TOKEN_EXPIRED"),
      );
    }
    if (error instanceof StampTokenReuseError) {
      return sendProblem(
        res,
        problem(409, "Token reuse", error.message, req.url ?? "/stamps/claim", "TOKEN_REUSE"),
      );
    }
    if (error instanceof PlanNotAllowedError) {
      return sendProblem(
        res,
        problem(
          403,
          "Plan not allowed",
          error.message,
          req.url ?? "/stamps/claim",
          "PLAN_NOT_ALLOWED",
        ),
      );
    }
    if (error instanceof ReferralTenantMismatchError) {
      return sendProblem(
        res,
        problem(
          409,
          "Referral tenant mismatch",
          error.message,
          req.url ?? "/stamps/claim",
          "REFERRAL_TENANT_MISMATCH",
        ),
      );
    }
    if (error instanceof SelfReferralBlockedError) {
      return sendProblem(
        res,
        problem(
          422,
          "Self referral blocked",
          error.message,
          req.url ?? "/stamps/claim",
          "SELF_REFERRAL_BLOCKED",
        ),
      );
    }
    if (error instanceof ReferralLimitReachedError) {
      return sendProblem(
        res,
        problem(
          422,
          "Referral limit reached",
          error.message,
          req.url ?? "/stamps/claim",
          "REFERRAL_LIMIT_REACHED",
        ),
      );
    }
    deps.logger?.error?.("stamp claim failed", error);
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/stamps/claim",
      ),
    );
  }
}
