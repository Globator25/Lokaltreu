import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

// CJS-Module als Default importieren:
import resourcesPkg from "@opentelemetry/resources";
import semconvPkg from "@opentelemetry/semantic-conventions";
const { Resource } = resourcesPkg as any;
const { SemanticResourceAttributes: S } = semconvPkg as any;

const sdk = new NodeSDK({
  resource: new Resource({
    [S.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "lokaltreu-api",
    [S.SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    [S.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development"
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? "http://localhost:4318/v1/traces"
  }),
  // Cast verhindert Typlärm, falls mehrere sdk-metrics-Versionen aufgelöst würden:
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? "http://localhost:4318/v1/metrics"
    })
  }) as any,
  instrumentations: [getNodeAutoInstrumentations()]
});

Promise.resolve().then(() => sdk.start()).catch(() => {});
process.on("SIGTERM", () => void sdk.shutdown());
