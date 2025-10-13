import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("lokaltreu-api");
const reqDur = meter.createHistogram("http_server_duration_ms", {
  description: "API Latenz (ms)",
});

export function withMetrics(req: any, res: any, next: Function) {
  const start = Date.now();

  res.on("finish", () => {
    try {
      const ms = Math.max(0, Date.now() - start);

      let route = (res as any)?.locals?.routeId;
      if (!route) {
        const raw = typeof req.url === "string" ? req.url : "/";
        route = new URL(raw, `http://${req.headers?.host ?? "localhost"}`).pathname;
      }

      const method = req?.method ?? "";
      const status = String(res?.statusCode ?? "");

      reqDur.record(ms, { route, method, status });
    } catch {
      // Telemetrie darf die Antwort nie blockieren
    }
  });

  if (typeof next === "function") next();
}
