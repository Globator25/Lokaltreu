import { InMemoryPlanWarningDedupStore, type PlanWarningDedupStore } from "./plan-dedup-store.js";

export type PlanCode = "starter" | "plus" | "premium";
export type PlanFeature = "referral" | "referrals" | "offers";

export type PlanLimits = {
  stampsPerMonth?: number | null;
  devicesAllowed?: number | null;
};

export type PlanPolicy = {
  code: PlanCode;
  features: Record<"referral" | "offers", boolean>;
  limits: PlanLimits;
};

export interface TenantPlanStore {
  getPlan(tenantId: string): Promise<PlanCode | undefined>;
  setPlan?: (tenantId: string, plan: PlanCode) => void;
}

const DEFAULT_PLAN: PlanCode = (process.env.DEFAULT_TENANT_PLAN as PlanCode) ?? "starter";

const PLAN_LIMIT_ENV = {
  stamps: {
    starter: "PLAN_LIMIT_STAMPS_STARTER",
    plus: "PLAN_LIMIT_STAMPS_PLUS",
    premium: "PLAN_LIMIT_STAMPS_PREMIUM",
  },
  devices: {
    starter: "PLAN_LIMIT_DEVICES_STARTER",
    plus: "PLAN_LIMIT_DEVICES_PLUS",
    premium: "PLAN_LIMIT_DEVICES_PREMIUM",
  },
} as const;

function parseLimit(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export class InMemoryTenantPlanStore implements TenantPlanStore {
  private readonly plans = new Map<string, PlanCode>();

  getPlan(tenantId: string): Promise<PlanCode | undefined> {
    return Promise.resolve(this.plans.get(tenantId));
  }

  setPlan(tenantId: string, plan: PlanCode) {
    this.plans.set(tenantId, plan);
  }
}

export function resolveTenantPlan(plan?: PlanCode): PlanCode {
  return plan ?? DEFAULT_PLAN;
}

export function normalizePlanFeature(feature: PlanFeature): "referral" | "offers" {
  if (feature === "referrals") {
    return "referral";
  }
  return feature;
}

export function planAllowsFeature(plan: PlanCode, feature: PlanFeature): boolean {
  const normalized = normalizePlanFeature(feature);
  if (normalized === "referral") {
    return plan !== "starter";
  }
  return true;
}

export function resolvePlanLimits(plan: PlanCode): PlanLimits {
  return {
    stampsPerMonth: parseLimit(process.env[PLAN_LIMIT_ENV.stamps[plan]]),
    devicesAllowed: parseLimit(process.env[PLAN_LIMIT_ENV.devices[plan]]),
  };
}

export function resolvePlanPolicy(plan: PlanCode): PlanPolicy {
  return {
    code: plan,
    features: {
      referral: planAllowsFeature(plan, "referral"),
      offers: planAllowsFeature(plan, "offers"),
    },
    limits: resolvePlanLimits(plan),
  };
}

export type PlanUsageResult = {
  usagePercent: number;
  threshold?: 80 | 100;
  shouldNotify: boolean;
};

export interface PlanCounterStore {
  incrementStamps: (params: {
    tenantId: string;
    periodKey: string;
    limit: number;
  }) => Promise<{ stampsUsed: number; limit: number }>;
}

export type PlanUsageTracker = {
  recordStamp: (params: {
    tenantId: string;
    plan: PlanCode;
    correlationId: string;
  }) => Promise<PlanUsageResult | null>;
};

export interface ActiveDeviceStore {
  countActive: (tenantId: string) => Promise<number>;
  markActive: (params: { tenantId: string; deviceId: string }) => Promise<void>;
}

export class InMemoryActiveDeviceStore implements ActiveDeviceStore {
  private readonly devicesByTenant = new Map<string, Set<string>>();

  countActive(tenantId: string): Promise<number> {
    return Promise.resolve(this.devicesByTenant.get(tenantId)?.size ?? 0);
  }

  markActive(params: { tenantId: string; deviceId: string }): Promise<void> {
    const existing = this.devicesByTenant.get(params.tenantId) ?? new Set<string>();
    existing.add(params.deviceId);
    this.devicesByTenant.set(params.tenantId, existing);
    return Promise.resolve();
  }
}

export class InMemoryPlanCounterStore implements PlanCounterStore {
  private readonly counters = new Map<string, { stampsUsed: number; limit: number }>();

  incrementStamps(params: {
    tenantId: string;
    periodKey: string;
    limit: number;
  }): Promise<{ stampsUsed: number; limit: number }> {
    const key = `${params.tenantId}:${params.periodKey}`;
    const current = this.counters.get(key) ?? { stampsUsed: 0, limit: params.limit };
    const next = { stampsUsed: current.stampsUsed + 1, limit: params.limit };
    this.counters.set(key, next);
    return Promise.resolve(next);
  }
}

function currentPeriodKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function getCurrentPeriodKey(now: Date = new Date()): string {
  return currentPeriodKey(now);
}

export function createPlanUsageTracker(params: {
  planStore: TenantPlanStore;
  counterStore?: PlanCounterStore;
  warningDedupStore?: PlanWarningDedupStore;
  now?: () => Date;
}): PlanUsageTracker {
  const counterStore = params.counterStore ?? new InMemoryPlanCounterStore();
  const warningDedupStore = params.warningDedupStore ?? new InMemoryPlanWarningDedupStore();
  const now = params.now ?? (() => new Date());

  return {
    async recordStamp({ tenantId, plan, correlationId }) {
      void correlationId;
      const limit = resolvePlanLimits(plan).stampsPerMonth;
      if (!limit) {
        return null;
      }
      const timestamp = now();
      const periodKey = currentPeriodKey(timestamp);
      const counter = await counterStore.incrementStamps({
        tenantId,
        periodKey,
        limit,
      });
      const usagePercent = Math.round((counter.stampsUsed / counter.limit) * 100);
      const threshold = usagePercent >= 100 ? 100 : usagePercent >= 80 ? 80 : undefined;
      if (!threshold) {
        return { usagePercent, shouldNotify: false };
      }
      let shouldNotify = true;
      if (warningDedupStore) {
        const alreadyEmitted = await warningDedupStore.hasEmitted(tenantId, periodKey, threshold);
        shouldNotify = !alreadyEmitted;
        if (shouldNotify) {
          await warningDedupStore.markEmitted(tenantId, periodKey, threshold);
        }
      }
      return { usagePercent, threshold, shouldNotify };
    },
  };
}
