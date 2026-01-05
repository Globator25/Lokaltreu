export type TenantPlan = "starter" | "plus" | "premium";
export type PlanFeature = "referral";

export interface TenantPlanStore {
  getPlan(tenantId: string): Promise<TenantPlan | undefined>;
  setPlan?: (tenantId: string, plan: TenantPlan) => void;
}

const DEFAULT_PLAN: TenantPlan = (process.env.DEFAULT_TENANT_PLAN as TenantPlan) ?? "starter";

export class InMemoryTenantPlanStore implements TenantPlanStore {
  private readonly plans = new Map<string, TenantPlan>();

  getPlan(tenantId: string): Promise<TenantPlan | undefined> {
    return Promise.resolve(this.plans.get(tenantId));
  }

  setPlan(tenantId: string, plan: TenantPlan) {
    this.plans.set(tenantId, plan);
  }
}

export function resolveTenantPlan(plan?: TenantPlan): TenantPlan {
  return plan ?? DEFAULT_PLAN;
}

export function planAllowsFeature(plan: TenantPlan, feature: PlanFeature): boolean {
  if (feature === "referral") {
    return plan !== "starter";
  }
  return true;
}

export async function requirePlanFeature(params: {
  tenantId: string;
  feature: PlanFeature;
  planStore: TenantPlanStore;
}): Promise<TenantPlan> {
  const resolved = resolveTenantPlan(await params.planStore.getPlan(params.tenantId));
  if (!planAllowsFeature(resolved, params.feature)) {
    throw new Error("PLAN_NOT_ALLOWED");
  }
  return resolved;
}
