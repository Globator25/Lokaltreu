import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { problem, sendProblem } from "../handlers/http-utils.js";
import { makePlanNotAllowedProblem } from "../problem/plan.js";
import { toProblemDetails } from "../problem/to-problem-details.js";
import {
  normalizePlanFeature,
  planAllowsFeature,
  resolveTenantPlan,
  type PlanFeature,
  type TenantPlanStore,
} from "../plan/plan-policy.js";

export type PlanGateRequest = IncomingMessage & {
  context?: {
    tenantId?: string;
    admin?: { tenantId: string };
    device?: { tenantId: string };
    correlation_id?: string;
    correlationId?: string;
  };
};

export type PlanGateDeps = {
  planStore: TenantPlanStore;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

export function resolveTenantId(req: PlanGateRequest): string | undefined {
  return (
    req.context?.tenantId ??
    req.context?.admin?.tenantId ??
    req.context?.device?.tenantId ??
    (typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : undefined)
  );
}

export function resolveRequestCorrelationId(req: PlanGateRequest): string {
  const existing = req.context?.correlation_id ?? req.context?.correlationId;
  const correlationId = existing && existing.trim() ? existing : randomUUID();
  req.context = { ...(req.context ?? {}), correlation_id: correlationId };
  return correlationId;
}

export async function requirePlanFeature(
  req: PlanGateRequest,
  res: ServerResponse,
  deps: PlanGateDeps,
  feature: PlanFeature,
): Promise<boolean> {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return true;
  }
  const correlationId = resolveRequestCorrelationId(req);
  let plan: ReturnType<typeof resolveTenantPlan>;
  try {
    plan = resolveTenantPlan(await deps.planStore.getPlan(tenantId));
  } catch (error) {
    deps.logger?.error?.("plan gate failed", {
      tenant_id: tenantId,
      correlation_id: correlationId,
      feature,
    });
    const fallback = problem(
      500,
      "Internal Server Error",
      "Unexpected error",
      req.url ?? "/",
    );
    const payload = toProblemDetails(error, fallback);
    sendProblem(res, payload);
    return false;
  }
  if (!planAllowsFeature(plan, feature)) {
    const normalized = normalizePlanFeature(feature);
    deps.logger?.warn?.("plan gate blocked", {
      tenant_id: tenantId,
      correlation_id: correlationId,
      feature: normalized,
      plan_code: plan,
    });
    sendProblem(
      res,
      makePlanNotAllowedProblem({
        correlationId,
        detail: "Plan feature not available for this tenant",
        instance: req.url ?? "/",
      }),
    );
    return false;
  }
  return true;
}
