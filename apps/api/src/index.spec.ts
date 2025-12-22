import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startOtelMock = vi.fn();

vi.setConfig({ testTimeout: 15000 });

vi.mock("./observability/otel", async () => {
  const actual = await vi.importActual<typeof import("./observability/otel")>(
    "./observability/otel",
  );
  return {
    ...actual,
    startOtel: startOtelMock,
  };
});

describe("createStartupPlan", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    startOtelMock.mockReset();
    process.env.LOKALTREU_DISABLE_OTEL_BOOTSTRAP = "true";
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete process.env.LOKALTREU_DISABLE_OTEL_BOOTSTRAP;
  });

  it(
    "derives otel config from the provided env",
    async () => {
      const env: NodeJS.ProcessEnv = {
        OTEL_SERVICE_NAME: "lokaltreu-api-test",
        DEPLOYMENT_ENVIRONMENT: "stage",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.dev:4318/",
        NODE_ENV: "production",
      };
      const { createStartupPlan } = await import("./index");
      const plan = createStartupPlan(env);
      expect(plan.otelConfig.resourceAttributes["service.name"]).toBe("lokaltreu-api-test");
      expect(plan.otelConfig.resourceAttributes["deployment.environment"]).toBe("stage");
      expect(plan.otelConfig.baseEndpoint).toBe("https://otel.dev:4318");
      expect(plan.otelConfig.nodeEnv).toBe("production");
    },
    15000,
  );

  it(
    "falls back to defaults when env values are missing",
    async () => {
      const env: NodeJS.ProcessEnv = {};
      const { createStartupPlan } = await import("./index");
      const plan = createStartupPlan(env);
      expect(plan.otelConfig.baseEndpoint).toBe("http://localhost:4318");
      expect(plan.otelConfig.resourceAttributes["deployment.environment"]).toBe("dev");
      expect(plan.otelConfig.nodeEnv).toBe("dev");
    },
    15000,
  );

  it("starts observability immediately on import", async () => {
    const env = { NODE_ENV: "development" };
    const { bootstrapObservability, createStartupPlan } = await import("./index");
    await bootstrapObservability(env);
    expect(startOtelMock).toHaveBeenCalledWith(createStartupPlan(env).otelConfig);
  });
});

describe("shouldBootstrap", () => {
  it("returns true when flag is not set", async () => {
    const { shouldBootstrap } = await import("./index");
    expect(shouldBootstrap({})).toBe(true);
  });

  it("returns false when disable flag is true", async () => {
    const { shouldBootstrap } = await import("./index");
    expect(shouldBootstrap({ LOKALTREU_DISABLE_OTEL_BOOTSTRAP: "true" })).toBe(false);
  });
});

describe("isEntryModule", () => {
  it("returns false when entry file missing", async () => {
    const { isEntryModule } = await import("./index");
    expect(isEntryModule([], "file://fake")).toBe(false);
  });

  it("returns true when argv[1] matches module url", async () => {
    const { isEntryModule } = await import("./index");
    const entry = "/tmp/index.js";
    expect(isEntryModule(["node", entry], pathToFileURL(entry).href)).toBe(true);
  });
});
