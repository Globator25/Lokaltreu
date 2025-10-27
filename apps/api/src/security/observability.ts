import { metrics, type Counter } from "@opentelemetry/api";
import type { MetricEvent, SecurityMetricName } from "@lokaltreu/types";

const meter = metrics.getMeter("lokaltreu-security");
const counters = new Map<SecurityMetricName, Counter>();

function getCounter(name: SecurityMetricName): Counter {
  const existing = counters.get(name);
  if (existing) {
    return existing;
  }

  const descriptions: Record<SecurityMetricName, string> = {
    device_proof_failed: "Counts rejected device proofs (SPEC: Abuse Detection, 60s Proof Window).",
    rate_token_reuse: "Counts replayed secure-action tokens (SPEC: Anti-Replay via Redis TTL=60s).",
  };

  const counter = meter.createCounter(name, {
    description: descriptions[name],
  });
  counters.set(name, counter);
  return counter;
}

export function emitSecurityMetric(event: MetricEvent): void {
  const counter = getCounter(event.name);
  counter.add(event.value ?? 1, event.attributes);
}
