import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, sendJson, sendProblem } from "../http-utils.js";
import type { ReferralLinkResult } from "../../services/referrals.service.js";
import { PlanNotAllowedError } from "../../services/referrals.service.js";

type ReferralLinkDeps = {
  service: {
    getReferralLink: (params: {
      tenantId: string;
      referrerCardId: string;
      baseUrl: string;
    }) => Promise<ReferralLinkResult>;
  };
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

type ReferralLinkRequest = IncomingMessage & {
  context?: {
    tenantId?: string;
    cardId?: string;
    admin?: { tenantId: string };
    device?: { tenantId: string };
  };
};

function readHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function resolveTenantId(req: ReferralLinkRequest): string | undefined {
  return req.context?.tenantId ?? req.context?.admin?.tenantId ?? req.context?.device?.tenantId ?? readHeader(req, "x-tenant-id");
}

function resolveCardId(req: ReferralLinkRequest): string | undefined {
  return req.context?.cardId ?? readHeader(req, "x-card-id");
}

function normalizeReferralBase(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("REFERRAL_BASE_URL_INVALID");
  }
  const origin = parsed.origin;
  if (!origin || origin === "null" || parsed.protocol !== "https:") {
    throw new Error("REFERRAL_BASE_URL_INVALID");
  }
  return `${origin}/r/`;
}

function resolveBaseUrl(req: IncomingMessage): string {
  // REFERRAL_BASE_URL is deprecated. REFERRAL_LINK_BASE_URL takes precedence but stays backward-compatible.
  const configured = process.env.REFERRAL_LINK_BASE_URL || process.env.REFERRAL_BASE_URL;
  // Prefer config-derived canonical base URLs. Host/X-Forwarded headers are a fallback and assume a trusted proxy.
  if (configured) {
    return normalizeReferralBase(configured);
  }
  const forwardedProto = readHeader(req, "x-forwarded-proto");
  const forwardedHost = readHeader(req, "x-forwarded-host");
  const host = forwardedHost ?? readHeader(req, "host");
  if (!host) {
    throw new Error("REFERRAL_BASE_URL_NOT_CONFIGURED");
  }
  const proto = forwardedProto ?? "https";
  return normalizeReferralBase(`${proto}://${host}`);
}

export async function handleGetReferralLink(
  req: ReferralLinkRequest,
  res: ServerResponse,
  deps: ReferralLinkDeps,
) {
  const tenantId = resolveTenantId(req);
  const cardId = resolveCardId(req);
  if (!tenantId || !cardId) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Missing tenant or card context", req.url ?? "/referrals/link"),
    );
  }

  try {
    const result = await deps.service.getReferralLink({
      tenantId,
      referrerCardId: cardId,
      // Prefer auth-derived context; only fall back to headers when no context exists.
      baseUrl: resolveBaseUrl(req),
    });
    return sendJson(res, 200, { refCodeURL: result.refCodeURL });
  } catch (error) {
    if (error instanceof PlanNotAllowedError) {
      return sendProblem(
        res,
        problem(
          403,
          "Plan not allowed",
          "Referral feature not available for this plan",
          req.url ?? "/referrals/link",
          "PLAN_NOT_ALLOWED",
        ),
      );
    }
    if (error instanceof Error && error.message === "REFERRAL_BASE_URL_NOT_CONFIGURED") {
      return sendProblem(
        res,
        problem(
          500,
          "Internal Server Error",
          "Referral base URL not configured",
          req.url ?? "/referrals/link",
        ),
      );
    }
    if (error instanceof Error && error.message === "REFERRAL_BASE_URL_INVALID") {
      return sendProblem(
        res,
        problem(
          500,
          "Internal Server Error",
          "Referral base URL is invalid",
          req.url ?? "/referrals/link",
        ),
      );
    }
    deps.logger?.error?.("referrals link failed", error);
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/referrals/link",
      ),
    );
  }
}
