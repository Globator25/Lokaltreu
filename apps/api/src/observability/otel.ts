import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

export type ResourceAttributes = Record<string, string>;

export type OtelConfig = {
  baseEndpoint: string;
  resourceAttributes: ResourceAttributes;
  nodeEnv: string;
};

type TraceExporterFactory = (
  options: ConstructorParameters<typeof OTLPTraceExporter>[0],
) => OTLPTraceExporter;
type MetricExporterFactory = (
  options: ConstructorParameters<typeof OTLPMetricExporter>[0],
) => OTLPMetricExporter;
type MetricReaderFactory = (
  options: ConstructorParameters<typeof PeriodicExportingMetricReader>[0],
) => PeriodicExportingMetricReader;

export type OtelDependencies = {
  createTraceExporter: TraceExporterFactory;
  createMetricExporter: MetricExporterFactory;
  createMetricReader: MetricReaderFactory;
  getNodeAutoInstrumentations: typeof getNodeAutoInstrumentations;
  NodeSDK: typeof NodeSDK;
};

type Logger = Pick<typeof console, "warn" | "error">;

const defaultDeps: OtelDependencies = {
  createTraceExporter: (options) => new OTLPTraceExporter(options),
  createMetricExporter: (options) => new OTLPMetricExporter(options),
  createMetricReader: (options) => new PeriodicExportingMetricReader(options),
  getNodeAutoInstrumentations,
  NodeSDK,
};

const defaultLogger: Logger = console;

let activeSdk: NodeSDK | null = null;
let currentNodeEnv = "dev";

export function normalizeEndpoint(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function buildResourceAttributes(env: NodeJS.ProcessEnv = process.env): ResourceAttributes {
  const deploymentEnv = env.DEPLOYMENT_ENVIRONMENT ?? env.NODE_ENV ?? "dev";
  const attrs: ResourceAttributes = {
    [SemanticResourceAttributes.SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? "lokaltreu-api",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
  };
  if (env.SERVICE_VERSION) {
    attrs[SemanticResourceAttributes.SERVICE_VERSION] = env.SERVICE_VERSION;
  }
  return attrs;
}

export function resolveOtelConfig(env: NodeJS.ProcessEnv = process.env): OtelConfig {
  return {
    baseEndpoint: normalizeEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318"),
    resourceAttributes: buildResourceAttributes(env),
    nodeEnv: env.NODE_ENV ?? "dev",
  };
}

function serializeResourceAttributes(attrs: ResourceAttributes): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

export function applyResourceAttributes(
  attrs: ResourceAttributes,
  targetEnv: NodeJS.ProcessEnv = process.env,
): string {
  const serialized = serializeResourceAttributes(attrs);
  const combined = [targetEnv.OTEL_RESOURCE_ATTRIBUTES, serialized].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  targetEnv.OTEL_RESOURCE_ATTRIBUTES = combined.join(",");
  return targetEnv.OTEL_RESOURCE_ATTRIBUTES;
}

function withDeps(overrides: Partial<OtelDependencies> = {}): OtelDependencies {
  return { ...defaultDeps, ...overrides };
}

export function createOtelSdk(
  config: OtelConfig,
  overrides: Partial<OtelDependencies> = {},
): NodeSDK {
  const deps = withDeps(overrides);
  const traceExporter = deps.createTraceExporter({
    url: `${config.baseEndpoint}/v1/traces`,
  });
  const metricExporter = deps.createMetricExporter({
    url: `${config.baseEndpoint}/v1/metrics`,
  });
  const metricReader = deps.createMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 2000,
    exportTimeoutMillis: 1000,
  });

  return new deps.NodeSDK({
    traceExporter,
    metricReader,
    instrumentations: [
      deps.getNodeAutoInstrumentations({}),
    ],
  });
}

function registerSignalHandlers(logger: Logger) {
  const handleSignal = (signal: NodeJS.Signals) => {
    if (currentNodeEnv !== "production") {
      logger.warn(`[observability] received ${signal}, shutting down`);
    }
    void shutdownObservability({ logger, exitProcess: true });
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
}

export type StartOptions = {
  logger?: Logger;
  autoRegisterSignals?: boolean;
  env?: NodeJS.ProcessEnv;
  deps?: Partial<OtelDependencies>;
};

export async function startOtel(
  config: OtelConfig,
  options: StartOptions = {},
): Promise<NodeSDK | null> {
  if (activeSdk) {
    return activeSdk;
  }
  const {
    logger = defaultLogger,
    autoRegisterSignals = true,
    env = process.env,
    deps,
  } = options;
  currentNodeEnv = config.nodeEnv;
  applyResourceAttributes(config.resourceAttributes, env);
  const sdk = createOtelSdk(config, deps);
  activeSdk = sdk;

  if (autoRegisterSignals) {
    registerSignalHandlers(logger);
  }

  try {
    await Promise.resolve(sdk.start());
    if (config.nodeEnv !== "production") {
      logger.warn("[observability] OpenTelemetry SDK started (resource attrs set)");
    }
    return sdk;
  } catch (error) {
    activeSdk = null;
    logger.error("[observability] OpenTelemetry SDK failed to start", error);
    return null;
  }
}

export type ShutdownOptions = {
  logger?: Logger;
  exitProcess?: boolean;
  exitCode?: number;
};

export async function shutdownObservability(options: ShutdownOptions = {}): Promise<void> {
  const { logger = defaultLogger, exitProcess = false, exitCode = 0 } = options;
  if (!activeSdk) {
    if (exitProcess) {
      process.exit(exitCode);
    }
    return;
  }

  try {
    await Promise.resolve(activeSdk.shutdown());
    if (currentNodeEnv !== "production") {
      logger.warn("[observability] OpenTelemetry SDK shut down");
    }
  } catch (error) {
    logger.error("[observability] OpenTelemetry SDK shutdown error", error);
  } finally {
    activeSdk = null;
    if (exitProcess) {
      process.exit(exitCode);
    }
  }
}
