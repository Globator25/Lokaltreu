#!/usr/bin/env node

/**
 * Deterministischer Observability-Smoke-Test:
 * 1) Prüft, ob localhost:$PORT erreichbar ist.
 * 2) Sendet POST /stamps/claim mit X-Correlation-ID.
 * 3) Sendet POST /rewards/redeem mit X-Correlation-ID.
 * Sämtliche Ausgaben erfolgen auf STDOUT/STDERR ohne zusätzliches Framework.
 */

const port = Number(process.env.PORT ?? process.env.DEV_API_PORT ?? 4010);
const baseUrl = `http://localhost:${port}`;

const routes = [
  { path: "/", method: "GET", label: "reachability" },
  { path: "/stamps/claim", method: "POST", label: "stamps-claim", correlationId: "obs-smoke-stamps" },
  {
    path: "/rewards/redeem",
    method: "POST",
    label: "rewards-redeem",
    correlationId: "obs-smoke-rewards",
  },
];

async function run() {
  console.log(`[smoke] Starting against ${baseUrl}`);
  for (const route of routes) {
    await callRoute(route);
  }
  console.log("[smoke] All checks passed (OK)");
}

async function callRoute(route) {
  const url = new URL(route.path, baseUrl).toString();
  const headers = {
    "content-type": "application/json",
    "x-correlation-id": route.correlationId ?? "obs-smoke-reachability",
  };

  try {
    const response = await fetch(url, {
      method: route.method,
      headers,
      body: route.method === "POST" ? JSON.stringify({ smoke: true }) : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[smoke][FAILED] ${route.label}: HTTP ${response.status} – ${body}`);
      process.exit(1);
    }

    console.log(`[smoke][OK] ${route.label}: ${route.method} ${route.path}`);
  } catch (error) {
    console.error(`[smoke][FAILED] ${route.label}: ${error?.message ?? error}`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("[smoke] Unexpected failure", error);
  process.exit(1);
});
