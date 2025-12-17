import "./observability/otel";
import { trace } from "@opentelemetry/api";
import {
  lokaltreuError5xxTotal,
  lokaltreuHttp429Total,
  lokaltreuReplayBlockedTotal,
} from "./observability/metrics";
import { shutdownObservability } from "./observability/otel";

const env = process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "dev";
const labels = { env };

lokaltreuHttp429Total.add(1, labels);
lokaltreuReplayBlockedTotal.add(1, labels);
lokaltreuError5xxTotal.add(1, labels);

const tracer = trace.getTracer("lokaltreu-dev-observability");
tracer.startActiveSpan("dev.observability.smoke", (span) => {
  span.setAttribute("env", env);
  span.end();
});

async function main() {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("[dev] emitted observability smoke signals (waited for export tick)");
      resolve();
    }, 15_000);
  });

  try {
    await shutdownObservability();
    process.exit(0);
  } catch (error) {
    console.error("[dev] shutdown failed", error);
    process.exit(1);
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error("[dev] unexpected failure", error);
    process.exit(1);
  }
})();
