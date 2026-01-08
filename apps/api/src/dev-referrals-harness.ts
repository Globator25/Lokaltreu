import { startReferralServer } from "./referrals-test-server.js";
import type { PlanCode } from "./plan/plan-policy.js";

const ALLOWED_PLANS: readonly PlanCode[] = ["starter", "plus", "premium"];
type EnvMap = Record<string, string | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const env: EnvMap = (() => {
  if (!isRecord(globalThis)) {
    return {};
  }
  const maybeProcess = globalThis["process"];
  if (!isRecord(maybeProcess)) {
    return {};
  }
  const maybeEnv = maybeProcess["env"];
  if (!isRecord(maybeEnv)) {
    return {};
  }
  const result: EnvMap = {};
  for (const [key, value] of Object.entries(maybeEnv)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
})();

function isPlanCode(value: string): value is PlanCode {
  return (ALLOWED_PLANS as readonly string[]).includes(value);
}

async function main() {
  try {
    const serverHandle = await startReferralServer();
    const rawPlanOverride = env.HARNESS_TENANT1_PLAN;
    const planOverride = rawPlanOverride?.trim();
    const hasOverride = Boolean(planOverride);
    let tenant1Plan: PlanCode = "plus";

    if (planOverride && isPlanCode(planOverride)) {
      if (
        serverHandle.planStore &&
        typeof serverHandle.planStore.setPlan === "function"
      ) {
        serverHandle.planStore.setPlan("tenant-1", planOverride);
        console.warn(
          `Override: tenant-1 -> ${planOverride} (HARNESS_TENANT1_PLAN)`
        );
        tenant1Plan = planOverride;
      } else {
        console.warn(
          "planStore not available on ServerHandle; cannot override tenant plan"
        );
      }
    } else if (hasOverride) {
      console.warn(
        `WARN: Invalid HARNESS_TENANT1_PLAN "${planOverride}", skipping override.`
      );
    }

    console.warn("Referrals Test-Harness Server läuft:");
    console.warn(`BASE_URL=${serverHandle.baseUrl}`);
    console.warn("Initial plans:");
    console.warn(`tenant-1: ${tenant1Plan}`);
    console.warn("tenant-2: plus");

    await new Promise<void>(() => {});
  } catch (err) {
    console.error("dev-referrals-harness failed:", err);
    return;
  }
}

void main();
