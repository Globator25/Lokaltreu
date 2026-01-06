import { hashToken } from "../handlers/http-utils.js";
import type { ReferralRecord, ReferralRepository, DbTransactionLike } from "../repositories/referrals.repo.js";
import { generateReferralCode } from "../repositories/referrals.repo.js";
import type { TenantPlanStore } from "./plan-gate.js";
import { planAllowsFeature, resolveTenantPlan } from "./plan-gate.js";

export class PlanNotAllowedError extends Error {
  constructor(message = "Plan not allowed") {
    super(message);
    this.name = "PlanNotAllowedError";
  }
}

export class ReferralNotFoundError extends Error {
  constructor(message = "Referral code not found") {
    super(message);
    this.name = "ReferralNotFoundError";
  }
}

export class ReferralTenantMismatchError extends Error {
  constructor(message = "Referral tenant mismatch") {
    super(message);
    this.name = "ReferralTenantMismatchError";
  }
}

export class SelfReferralBlockedError extends Error {
  constructor(message = "Self referral blocked") {
    super(message);
    this.name = "SelfReferralBlockedError";
  }
}

export class ReferralLimitReachedError extends Error {
  constructor(message = "Referral limit reached") {
    super(message);
    this.name = "ReferralLimitReachedError";
  }
}

export type ReferralLinkResult = {
  code: string;
  refCodeURL: string;
  created: boolean;
};

export type ReferralContext = {
  referral: ReferralRecord;
  referrerCardId: string;
};

export type ReferralServiceDeps = {
  repo: ReferralRepository;
  planStore: TenantPlanStore;
  audit?: { log: (event: string, payload: Record<string, unknown>) => Promise<void> | void };
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  now?: () => Date;
};

const REFERRAL_LIMIT_PER_MONTH = 5;

function monthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end };
}

function buildReferralUrl(baseUrl: string, code: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(code, normalized).toString();
}

export function createReferralService(deps: ReferralServiceDeps) {
  const now = deps.now ?? (() => new Date());

  async function requireReferralPlan(tenantId: string): Promise<void> {
    const plan = resolveTenantPlan(await deps.planStore.getPlan(tenantId));
    if (!planAllowsFeature(plan, "referral")) {
      throw new PlanNotAllowedError();
    }
  }

  return {
    async getReferralLink(params: {
      tenantId: string;
      referrerCardId: string;
      baseUrl: string;
      tx?: DbTransactionLike;
    }): Promise<ReferralLinkResult> {
      await requireReferralPlan(params.tenantId);

      const existing = await deps.repo.findActiveByReferrer(
        params.tenantId,
        params.referrerCardId,
        params.tx,
      );
      if (existing) {
        return {
          code: existing.code,
          refCodeURL: buildReferralUrl(params.baseUrl, existing.code),
          created: false,
        };
      }

      let created: ReferralRecord | null = null;
      for (let attempts = 0; attempts < 3; attempts += 1) {
        const code = generateReferralCode();
        try {
          created = await deps.repo.createReferralCode(
            {
              tenantId: params.tenantId,
              referrerCardId: params.referrerCardId,
              code,
            },
            params.tx,
          );
          break;
        } catch (error) {
          deps.logger?.warn?.("referral code collision", error);
        }
      }
      if (!created) {
        throw new Error("Failed to create referral code");
      }

      await deps.audit?.log("referral.link.issued", {
        tenant_id: params.tenantId,
        referrer_card_id: params.referrerCardId,
        referral_code_hash: hashToken(created.code),
      });

      return {
        code: created.code,
        refCodeURL: buildReferralUrl(params.baseUrl, created.code),
        created: true,
      };
    },

    async resolveReferralContext(params: {
      tenantId: string;
      referredCardId: string;
      code: string;
      tx?: DbTransactionLike;
    }): Promise<ReferralContext | null> {
      await requireReferralPlan(params.tenantId);

      const referral = await deps.repo.findByCode(params.code, params.tx);
      if (!referral || referral.qualified) {
        return null;
      }
      if (referral.tenantId !== params.tenantId) {
        throw new ReferralTenantMismatchError();
      }
      if (referral.referrerCardId === params.referredCardId) {
        throw new SelfReferralBlockedError();
      }

      return { referral, referrerCardId: referral.referrerCardId };
    },

    async hasFirstStamp(params: { tenantId: string; cardId: string; tx?: DbTransactionLike }) {
      return deps.repo.hasFirstStamp(
        { tenantId: params.tenantId, cardId: params.cardId },
        params.tx,
      );
    },

    async markFirstStampIfAbsent(params: {
      tenantId: string;
      cardId: string;
      tx?: DbTransactionLike;
    }): Promise<boolean> {
      return deps.repo.markFirstStampIfAbsent(
        { tenantId: params.tenantId, cardId: params.cardId, firstStampAt: now() },
        params.tx,
      );
    },

    async qualifyReferral(params: {
      tenantId: string;
      referral: ReferralRecord;
      referredCardId: string;
      tx?: DbTransactionLike;
    }): Promise<boolean> {
      const { start, end } = monthRange(now());
      const count = await deps.repo.countQualifiedForMonth(
        {
          tenantId: params.tenantId,
          referrerCardId: params.referral.referrerCardId,
          monthStart: start,
          monthEnd: end,
        },
        params.tx,
      );
      if (count >= REFERRAL_LIMIT_PER_MONTH) {
        throw new ReferralLimitReachedError();
      }

      const qualified = await deps.repo.qualifyReferral(
        {
          tenantId: params.tenantId,
          code: params.referral.code,
          referredCardId: params.referredCardId,
          firstStampAt: now(),
        },
        params.tx,
      );

      if (qualified) {
        await deps.audit?.log("referral.first_stamp.qualified", {
          tenant_id: params.tenantId,
          referrer_card_id: params.referral.referrerCardId,
          referred_card_id: params.referredCardId,
          referral_code_hash: hashToken(params.referral.code),
        });
      }

      return qualified;
    },

    async markBonusCredited(params: {
      tenantId: string;
      referral: ReferralRecord;
      referredCardId: string;
      tx?: DbTransactionLike;
    }): Promise<boolean> {
      const credited = await deps.repo.markBonusCredited(
        { tenantId: params.tenantId, code: params.referral.code, creditedAt: now() },
        params.tx,
      );
      if (credited) {
        await deps.audit?.log("referral.bonus_stamp.credited", {
          tenant_id: params.tenantId,
          referrer_card_id: params.referral.referrerCardId,
          referred_card_id: params.referredCardId,
          referral_code_hash: hashToken(params.referral.code),
        });
      }
      return credited;
    },
  };
}
