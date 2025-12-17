#!/usr/bin/env node

const baseUrl = process.env.OBS_SMOKE_BASE_URL ?? "http://localhost:3002";
const metricsUrl = process.env.OBS_SMOKE_METRICS_URL ?? "http://localhost:8889/metrics";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

async function main() {
  if (!otlpEndpoint) {
    console.error("[smoke] OTEL_EXPORTER_OTLP_ENDPOINT is not set – aborting");
    process.exit(1);
  }

  console.log(`[smoke] Using API base ${baseUrl}`);
  console.log(`[smoke] Metrics endpoint ${metricsUrl}`);
  console.log(`[smoke] OTLP endpoint ${otlpEndpoint}`);

  await hitEndpoint("/stamps/claim?mode=ratelimit", 429);
  await hitEndpoint("/rewards/redeem?mode=replay", 409);

  await verifyMetrics();

  console.log("[smoke] Observability smoke test passed");
}

async function hitEndpoint(path, expectedStatus) {
  const url = new URL(path, baseUrl).toString();
  console.log(`[smoke] Requesting ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-test": "observability",
    },
    body: JSON.stringify({ stub: true }),
  }).catch((error) => {
    console.error(`[smoke] Request failed: ${error?.message ?? error}`);
    process.exit(1);
  });

  if (res.status !== expectedStatus) {
    console.error(`[smoke] Expected status ${expectedStatus}, got ${res.status}`);
    const text = await res.text();
    console.error(`[smoke] Response body: ${text}`);
    process.exit(1);
  }
}

async function verifyMetrics() {
  console.log("[smoke] Fetching metrics");
  const res = await fetch(metricsUrl);
  if (!res.ok) {
    console.error(`[smoke] Metrics endpoint returned ${res.status}`);
    process.exit(1);
  }
  const body = await res.text();
  const candidates = [
    "lokaltreu_http_429_total",
    "lokaltreu_replay_blocked_total",
    "lokaltreu_finops_cost_per_tenant_eur_monthly",
  ];
  const found = candidates.filter((metric) => body.includes(metric));
  if (found.length === 0) {
    console.error("[smoke] None of the expected metrics found in scrape output");
    process.exit(1);
  }
  console.log(`[smoke] Metrics confirmed: ${found.join(", ")}`);
}

main();
