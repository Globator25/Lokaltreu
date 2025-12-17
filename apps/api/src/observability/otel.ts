import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

function normalizeEndpoint(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const baseEndpoint = normalizeEndpoint(
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
);

const resourceAttributes: Record<string, string> = {
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "lokaltreu-api",
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
    process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "dev",
};

if (process.env.SERVICE_VERSION) {
  resourceAttributes[SemanticResourceAttributes.SERVICE_VERSION] = process.env.SERVICE_VERSION;
}

const serializedAttrs = Object.entries(resourceAttributes)
  .map(([key, value]) => `${key}=${value}`)
  .join(",");

if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
  process.env.OTEL_RESOURCE_ATTRIBUTES = [
    process.env.OTEL_RESOURCE_ATTRIBUTES,
    serializedAttrs,
  ]
    .filter(Boolean)
    .join(",");
} else {
  process.env.OTEL_RESOURCE_ATTRIBUTES = serializedAttrs;
}

const traceExporter = new OTLPTraceExporter({
  url: `${baseEndpoint}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${baseEndpoint}/v1/metrics`,
});


const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 2000,
  exportTimeoutMillis: 1000,
});


const sdk = new NodeSDK({
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
    }),
  ],
});

Promise.resolve(sdk.start())
  .then(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[observability] OpenTelemetry SDK started (resource attrs set)");
    }
  })
  .catch((error) => {
    console.error("[observability] OpenTelemetry SDK failed to start", error);
  });

const shutdown = () => {
  Promise.resolve(sdk.shutdown())
    .then(() => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[observability] OpenTelemetry SDK shut down");
      }
    })
    .catch((error) => {
      console.error("[observability] OpenTelemetry SDK shutdown error", error);
    })
    .finally(() => {
      process.exit(0);
    });
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

export async function shutdownObservability(): Promise<void> {
  try {
    await Promise.resolve(sdk.shutdown());
  } catch (error) {
    console.error("[observability] shutdownObservability error", error);
  }
}
