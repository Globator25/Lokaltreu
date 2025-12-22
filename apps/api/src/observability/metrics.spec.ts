import { describe, it, expect, vi, afterEach } from "vitest";

type MetricAttrs = Record<string, string | number | boolean>;
type ObservableResultLike = {
  observe: (instrument: { name: string }, value: number, labels?: MetricAttrs) => void;
};

type ApiMock = typeof import("@opentelemetry/api") & {
  __test: {
    callbacks: Array<(observableResult: ObservableResultLike) => void>;
  };
};

vi.mock("@opentelemetry/api", () => {
  const callbacks: ApiMock["__test"]["callbacks"] = [];
  const meter = {
    createCounter: vi.fn(),
    createHistogram: vi.fn(),
    createObservableGauge: vi.fn((name: string) => ({ name })),
    addBatchObservableCallback: vi.fn((cb: (res: ObservableResultLike) => void) => {
      callbacks.push(cb);
    }),
  };

  return {
    metrics: {
      getMeter: () => meter,
    },
    ValueType: { INT: "int" },
    __test: { callbacks },
  };
});

async function loadMetricsModule() {
  vi.resetModules();
  const module = await import("./metrics");
  const apiMock = (await import("@opentelemetry/api")) as ApiMock;
  const callback = apiMock.__test.callbacks.at(-1);
  if (!callback) {
    throw new Error("Batch observable callback not registered");
  }
  return { module, callback };
}

function collectObservations(callback: (observableResult: ObservableResultLike) => void) {
  const observations: Array<{ name: string; value: number; labels?: MetricAttrs }> = [];
  const observableResult = {
    observe: (instrument: { name: string }, value: number, labels?: MetricAttrs) => {
      observations.push({ name: instrument.name, value, labels });
    },
  };
  callback(observableResult);
  return observations;
}

afterEach(() => {
  delete process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY;
  delete process.env.FINOPS_ACTIVE_TENANTS;
});

describe("finops snapshot gauges", () => {
  it("computes per-tenant cost with sanitized inputs", async () => {
    process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY = JSON.stringify({
      db: 120.45,
      redis: 9.1,
    });
    process.env.FINOPS_ACTIVE_TENANTS = "5";

    const { callback } = await loadMetricsModule();
    const observations = collectObservations(callback);

    const perTenant = observations.find((obs) =>
      obs.name === "lokaltreu_finops_cost_per_tenant_eur_monthly",
    );
    const activeTenants = observations.find((obs) => obs.name === "lokaltreu_active_tenants");
    const componentEntries = observations.filter((obs) =>
      obs.name === "lokaltreu_finops_cost_component_eur_monthly",
    );

    expect(perTenant?.value).toBeCloseTo(25.91, 2);
    expect(activeTenants?.value).toBe(5);
    expect(componentEntries).toHaveLength(2);
    componentEntries.forEach((entry) => {
      expect(entry.labels?.env).toBeDefined();
      expect(entry.labels?.component).toBeDefined();
    });
  });

  it("sets per-tenant cost to zero when no tenants are active", async () => {
    process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY = JSON.stringify({
      api: 40,
      invalid: "noop",
    });
    process.env.FINOPS_ACTIVE_TENANTS = "0";

    const { callback } = await loadMetricsModule();
    const observations = collectObservations(callback);

    const perTenant = observations.find((obs) =>
      obs.name === "lokaltreu_finops_cost_per_tenant_eur_monthly",
    );
    const activeTenants = observations.find((obs) => obs.name === "lokaltreu_active_tenants");

    expect(perTenant?.value).toBe(0);
    expect(activeTenants?.value).toBe(0);
  });

  it("warns on invalid component JSON and input", async () => {
    const logger = { warn: vi.fn() };
    process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY = "invalid json";
    process.env.FINOPS_ACTIVE_TENANTS = "-5";

    const { module, callback } = await loadMetricsModule();
    const observations = collectObservations(callback);

    const perTenant = observations.find((obs) =>
      obs.name === "lokaltreu_finops_cost_per_tenant_eur_monthly",
    );
    const activeTenants = observations.find((obs) => obs.name === "lokaltreu_active_tenants");

    expect(perTenant?.value).toBe(0);
    expect(activeTenants?.value).toBe(0);

    // Force refresh to hit log branches
    module.__test?.refreshFinopsSnapshot?.(logger);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe("finops warnings", () => {
  it("warns when cost env has no valid entries", async () => {
    process.env.FINOPS_COST_COMPONENTS_EUR_MONTHLY = JSON.stringify({
      invalid: "noop",
    });
    const { module } = await loadMetricsModule();
    const logger = { warn: vi.fn() };
    module.__test?.readComponentCosts?.(logger);
    expect(logger.warn).toHaveBeenCalledWith(
      "[finops] FINOPS_COST_COMPONENTS_EUR_MONTHLY has no valid entries",
    );
  });

  it("logs when refresh tick throws", async () => {
    const { module } = await loadMetricsModule();
    const logger = { warn: vi.fn() };
    module.__test?.runFinopsRefreshTick?.(logger, () => {
      throw new Error("boom");
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "[finops] Failed to refresh snapshot",
      expect.any(Error),
    );
  });
});

describe("sanitizeRoute", () => {
  it("removes query parameters and handles empty values", async () => {
    const { module } = await loadMetricsModule();
    expect(module.sanitizeRoute("/stamps/claim?foo=bar")).toBe("/stamps/claim");
    expect(module.sanitizeRoute(undefined)).toBe("unknown");
  });
});
