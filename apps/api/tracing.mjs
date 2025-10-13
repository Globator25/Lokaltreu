import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";

// einige OTel-Pakete sind CJS → dynamisch laden
const resourcesMod = await import("@opentelemetry/resources");
const semconvMod   = await import("@opentelemetry/semantic-conventions");

const Resource = resourcesMod.Resource ?? resourcesMod.default?.Resource;
const S = semconvMod.SemanticResourceAttributes ?? semconvMod.default?.SemanticResourceAttributes;

const attrs = {
  [S.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "lokaltreu-api",
  [S.SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
  [S.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
};

const resource =
  (Resource?.fromAttributes ? Resource.fromAttributes(attrs) : new Resource(attrs));

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? "http://localhost:4318/v1/metrics",
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  contextManager: new AsyncLocalStorageContextManager(),
});

await sdk.start();
process.on("SIGTERM", () => sdk.shutdown().finally(() => process.exit(0)));
