import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyResourceAttributes,
  buildResourceAttributes,
  createOtelSdk,
  normalizeEndpoint,
  resolveOtelConfig,
  shutdownObservability,
  startOtel,
  type OtelConfig,
  type OtelDependencies,
} from "./otel";

function createFakeSdk() {
  const start = vi.fn().mockResolvedValue(undefined);
  const shutdown = vi.fn().mockResolvedValue(undefined);
  class FakeNodeSdk {
    public start = start;
    public shutdown = shutdown;
    constructor(public options: unknown) {}
  }
  return { FakeNodeSdk, start, shutdown };
}

type TraceExporterInstance = ReturnType<OtelDependencies["createTraceExporter"]>;
type MetricExporterInstance = ReturnType<OtelDependencies["createMetricExporter"]>;
type MetricReaderInstance = ReturnType<OtelDependencies["createMetricReader"]>;
type Instrumentations = ReturnType<OtelDependencies["getNodeAutoInstrumentations"]>;

type DepsBundle = {
  deps: Partial<OtelDependencies>;
  traceFactory: ReturnType<typeof vi.fn<OtelDependencies["createTraceExporter"]>>;
  metricFactory: ReturnType<typeof vi.fn<OtelDependencies["createMetricExporter"]>>;
  readerFactory: ReturnType<typeof vi.fn<OtelDependencies["createMetricReader"]>>;
  instrumentation: ReturnType<typeof vi.fn<OtelDependencies["getNodeAutoInstrumentations"]>>;
  fakeSdk: ReturnType<typeof createFakeSdk>;
  metricInstance: MetricExporterInstance;
};

function createDeps(): DepsBundle {
  const traceInstance = { trace: true } as unknown as TraceExporterInstance;
  const metricInstance = { metric: true } as unknown as MetricExporterInstance;
  const readerInstance = { reader: true } as unknown as MetricReaderInstance;
  const instrumentationInstance = [] as unknown as Instrumentations;
  const traceFactory = vi.fn<OtelDependencies["createTraceExporter"]>(() => traceInstance);
  const metricFactory = vi.fn<OtelDependencies["createMetricExporter"]>(() => metricInstance);
  const readerFactory = vi.fn<OtelDependencies["createMetricReader"]>(() => readerInstance);
  const instrumentation = vi.fn<OtelDependencies["getNodeAutoInstrumentations"]>(
    () => instrumentationInstance,
  );
  const fakeSdk = createFakeSdk();

  return {
    deps: {
      createTraceExporter: traceFactory,
      createMetricExporter: metricFactory,
      createMetricReader: readerFactory,
      getNodeAutoInstrumentations: instrumentation,
      NodeSDK: fakeSdk.FakeNodeSdk as unknown as OtelDependencies["NodeSDK"],
    },
    traceFactory,
    metricFactory,
    readerFactory,
    instrumentation,
    fakeSdk,
    metricInstance,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.OTEL_RESOURCE_ATTRIBUTES;
  await shutdownObservability();
});

describe("normalizeEndpoint", () => {
  it("removes trailing slash", () => {
    expect(normalizeEndpoint("https://collector.example/")).toBe("https://collector.example");
  });
});

describe("resolveOtelConfig", () => {
  it("derives resource attributes and endpoint from env", () => {
    const env: NodeJS.ProcessEnv = {
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.local:4318/",
      OTEL_SERVICE_NAME: "lokaltreu-test",
      DEPLOYMENT_ENVIRONMENT: "stage",
      SERVICE_VERSION: "1.2.3",
      NODE_ENV: "production",
    };
    const config = resolveOtelConfig(env);
    expect(config.baseEndpoint).toBe("https://otel.local:4318");
    expect(config.resourceAttributes["service.name"]).toBe("lokaltreu-test");
    expect(config.resourceAttributes["deployment.environment"]).toBe("stage");
    expect(config.resourceAttributes["service.version"]).toBe("1.2.3");
    expect(config.nodeEnv).toBe("production");
  });

  it("falls back to default endpoint and env when variables are missing", () => {
    const config = resolveOtelConfig({});
    expect(config.baseEndpoint).toBe("http://localhost:4318");
    expect(config.resourceAttributes["service.name"]).toBe("lokaltreu-api");
    expect(config.resourceAttributes["deployment.environment"]).toBe("dev");
    expect(config.nodeEnv).toBe("dev");
  });
});

describe("buildResourceAttributes", () => {
  it("sets service.name and deployment.environment", () => {
    const attrs = buildResourceAttributes({
      OTEL_SERVICE_NAME: "custom-api",
      DEPLOYMENT_ENVIRONMENT: "stage",
    });
    expect(attrs["service.name"]).toBe("custom-api");
    expect(attrs["deployment.environment"]).toBe("stage");
  });
});

describe("applyResourceAttributes", () => {
  it("appends to existing OTEL_RESOURCE_ATTRIBUTES", () => {
    const env: NodeJS.ProcessEnv = { OTEL_RESOURCE_ATTRIBUTES: "foo=bar" };
    const attrs = buildResourceAttributes({
      DEPLOYMENT_ENVIRONMENT: "dev",
      NODE_ENV: "development",
    });
    const serialized = applyResourceAttributes(attrs, env);
    expect(serialized).toContain("foo=bar");
    expect(serialized.split(",").length).toBeGreaterThan(1);
  });
});

describe("createOtelSdk", () => {
  it("constructs exporters and readers with expected endpoints", () => {
    const config: OtelConfig = {
      baseEndpoint: "http://collector",
      resourceAttributes: buildResourceAttributes(),
      nodeEnv: "dev",
    };
    const {
      deps,
      traceFactory,
      metricFactory,
      readerFactory,
      instrumentation,
      fakeSdk,
      metricInstance,
    } = createDeps();
    const sdk = createOtelSdk(config, deps);
    expect(traceFactory).toHaveBeenCalledWith({ url: "http://collector/v1/traces" });
    expect(metricFactory).toHaveBeenCalledWith({ url: "http://collector/v1/metrics" });
    expect(readerFactory).toHaveBeenCalledWith({
      exporter: metricInstance,
      exportIntervalMillis: 2000,
      exportTimeoutMillis: 1000,
    });
    expect(instrumentation).toHaveBeenCalledWith({});
    expect(sdk).toBeInstanceOf(fakeSdk.FakeNodeSdk);
  });
});

describe("startOtel", () => {
  it("starts the SDK and logs when not in production", async () => {
    const { deps, fakeSdk } = createDeps();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: false,
      env,
      deps,
    });
    expect(fakeSdk.start).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "[observability] OpenTelemetry SDK started (resource attrs set)",
    );
    await shutdownObservability({ logger });
    expect(fakeSdk.shutdown).toHaveBeenCalled();
  });

  it("logs errors when SDK start fails and allows retry", async () => {
    const failingSdk = createFakeSdk();
    failingSdk.start.mockRejectedValueOnce(new Error("boom"));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    const deps: Partial<OtelDependencies> = {
      createTraceExporter: vi.fn<OtelDependencies["createTraceExporter"]>(
        () => ({} as TraceExporterInstance),
      ),
      createMetricExporter: vi.fn<OtelDependencies["createMetricExporter"]>(
        () => ({} as MetricExporterInstance),
      ),
      createMetricReader: vi.fn<OtelDependencies["createMetricReader"]>(
        () => ({} as MetricReaderInstance),
      ),
      getNodeAutoInstrumentations: vi.fn<OtelDependencies["getNodeAutoInstrumentations"]>(
        () => ([] as unknown as Instrumentations),
      ),
      NodeSDK: failingSdk.FakeNodeSdk as unknown as OtelDependencies["NodeSDK"],
    };

    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: false,
      env,
      deps,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "[observability] OpenTelemetry SDK failed to start",
      expect.any(Error),
    );

    const recoverySdk = createDeps();
    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: false,
      env,
      deps: recoverySdk.deps,
    });
    expect(recoverySdk.fakeSdk.start).toHaveBeenCalled();
    await shutdownObservability({ logger });
  });

  it("registers signal handlers when enabled", async () => {
    const { deps } = createDeps();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const onceSpy = vi.spyOn(process, "once").mockImplementation(() => process);
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: true,
      env,
      deps,
    });
    expect(onceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    onceSpy.mockRestore();
    await shutdownObservability({ logger });
  });
});

describe("startOtel additional coverage", () => {
  it("returns cached SDK when already active", async () => {
    const { deps, fakeSdk } = createDeps();
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    const config = resolveOtelConfig(env);
    const first = await startOtel(config, {
      logger: { warn: vi.fn(), error: vi.fn() },
      autoRegisterSignals: false,
      env,
      deps,
    });
    const second = await startOtel(config, {
      logger: { warn: vi.fn(), error: vi.fn() },
      autoRegisterSignals: false,
      env,
      deps,
    });
    expect(second).toBe(first);
    expect(fakeSdk.start).toHaveBeenCalledTimes(1);
    await shutdownObservability();
  });

  it("logs and triggers shutdown via signal handler", async () => {
    const { deps, fakeSdk } = createDeps();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const onceSpy = vi.spyOn(process, "once").mockImplementation(() => process);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };

    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: true,
      env,
      deps,
    });

    const handler = onceSpy.mock.calls.find(([signal]) => signal === "SIGINT")?.[1];
    expect(handler).toBeDefined();
    if (handler) {
      handler("SIGINT");
    }
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith("[observability] received SIGINT, shutting down");
    expect(fakeSdk.shutdown).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    onceSpy.mockRestore();
    exitSpy.mockRestore();
    await shutdownObservability({ logger });
  });
});

describe("shutdownObservability additional coverage", () => {
  it("exits immediately when no SDK but exitProcess true", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await shutdownObservability({ exitProcess: true, exitCode: 5 });
    expect(exitSpy).toHaveBeenCalledWith(5);
    exitSpy.mockRestore();
  });

  it("exits after shutting down active SDK", async () => {
    const { deps } = createDeps();
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    await startOtel(resolveOtelConfig(env), {
      logger: { warn: vi.fn(), error: vi.fn() },
      autoRegisterSignals: false,
      env,
      deps,
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await shutdownObservability({ exitProcess: true, exitCode: 0 });
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("logs errors when shutdown fails", async () => {
    const { deps, fakeSdk } = createDeps();
    const env: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    const logger = { warn: vi.fn(), error: vi.fn() };
    await startOtel(resolveOtelConfig(env), {
      logger,
      autoRegisterSignals: false,
      env,
      deps,
    });

    const failure = new Error("fail");
    fakeSdk.shutdown.mockRejectedValueOnce(failure);
    await shutdownObservability({ logger });
    expect(logger.error).toHaveBeenCalledWith(
      "[observability] OpenTelemetry SDK shutdown error",
      failure,
    );
  });
});
