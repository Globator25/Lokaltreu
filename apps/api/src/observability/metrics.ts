import { metrics, ValueType } from "@opentelemetry/api";

const meter = metrics.getMeter("lokaltreu-api");

export const httpRequestsTotal = meter.createCounter("http_server_requests_total", {
  description: "Total HTTP requests",
  valueType: ValueType.INT,
});

export const httpErrorsTotal = meter.createCounter("http_server_errors_total", {
  description: "Total HTTP error responses (4xx/5xx)",
  valueType: ValueType.INT,
});

export const httpRateLimitedTotal = meter.createCounter("rate_limited_total", {
  description: "Total requests rate-limited (HTTP 429)",
  valueType: ValueType.INT,
});

export const httpDurationMs = meter.createHistogram("http_server_duration_ms", {
  description: "HTTP server request duration in milliseconds",
  unit: "ms",
});

export function sanitizeRoute(url?: string): string {
  if (!url) return "unknown";
  // Governance: keine Query Params als Label
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

export const lokaltreuHttp429Total = meter.createCounter("lokaltreu_http_429_total", {
  description: "Total HTTP 429 responses",
});

export const lokaltreuReplayBlockedTotal = meter.createCounter("lokaltreu_replay_blocked_total", {
  description: "Total replay attempts blocked",
});

export const lokaltreuError5xxTotal = meter.createCounter("lokaltreu_error_5xx_total", {
  description: "Total HTTP 5xx responses",
});

const finopsComponentGauge = meter.createObservableGauge("lokaltreu_finops_cost_component_eur_monthly", {
  description: "Cost per component (EUR per month)",
});

const finopsPerTenantGauge = meter.createObservableGauge("lokaltreu_finops_cost_per_tenant_eur_monthly", {
  description: "Monthly cost per tenant (EUR)",
});

const activeTenantsGauge = meter.createObservableGauge("lokaltreu_active_tenants", {
  description: "Number of active tenants",
  valueType: ValueType.INT,
});

type ComponentCosts = Record<string, number>;

function readComponentCosts(logger: Pick<typeof console, "warn">): ComponentCosts {
  const raw = process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const sanitized: ComponentCosts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        sanitized[key] = value;
      }
    }
    if (!Object.keys(sanitized).length) {
      logger.warn("[finops] FINOPS_COST_COMPONENTS_EUR_MONTHLY has no valid entries");
    }
    return sanitized;
  } catch {
    logger.warn("[finops] Invalid JSON in FINOPS_COST_COMPONENTS_EUR_MONTHLY");
    return {};
  }
}

function readActiveTenants(logger: Pick<typeof console, "warn">): number {
  const raw = process.env.FINOPS_ACTIVE_TENANTS;
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) {
    logger.warn("[finops] FINOPS_ACTIVE_TENANTS must be a non-negative integer");
    return 0;
  }
  return Math.floor(parsed);
}

type FinopsSnapshot = {
  components: ComponentCosts;
  activeTenants: number;
  perTenant: number;
};

let finopsSnapshot: FinopsSnapshot = {
  components: {},
  activeTenants: 0,
  perTenant: 0,
};

function refreshFinopsSnapshot(logger: Pick<typeof console, "warn"> = console): void {
  const components = readComponentCosts(logger);
  const activeTenants = readActiveTenants(logger);
  let totalCost = 0;
  for (const amount of Object.values(components)) {
    totalCost += amount;
  }
  const perTenant = activeTenants > 0 ? Number((totalCost / activeTenants).toFixed(2)) : 0;
  finopsSnapshot = { components, activeTenants, perTenant };
}

refreshFinopsSnapshot();
function runFinopsRefreshTick(
  logger: Pick<typeof console, "warn"> = console,
  refresher: (log: Pick<typeof console, "warn">) => void = refreshFinopsSnapshot,
): void {
  try {
    refresher(logger);
  } catch (error) {
    logger.warn("[finops] Failed to refresh snapshot", error);
  }
}

const finopsInterval = setInterval(() => {
  runFinopsRefreshTick();
}, 60_000);
if (typeof finopsInterval.unref === "function") {
  finopsInterval.unref();
}

meter.addBatchObservableCallback(
  (observableResult) => {
    const { components, activeTenants, perTenant } = finopsSnapshot;
    const labels = { env: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "dev" };

    for (const [component, amount] of Object.entries(components)) {
      observableResult.observe(finopsComponentGauge, amount, { ...labels, component });
    }

    observableResult.observe(activeTenantsGauge, activeTenants, labels);
    observableResult.observe(finopsPerTenantGauge, perTenant, labels);
  },
  [
    finopsComponentGauge,
    finopsPerTenantGauge,
    activeTenantsGauge,
  ],
);

export const __test = {
  refreshFinopsSnapshot,
  readComponentCosts,
  runFinopsRefreshTick,
};
