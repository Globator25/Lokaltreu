import type { Request, Response, NextFunction } from "express";
import { metrics } from "@opentelemetry/api";
import { performance } from "node:perf_hooks";

const meter = metrics.getMeter("lokaltreu-api");
const reqDur = meter.createHistogram("http_server_duration_ms", {
  description: "API Latenz",
  unit: "ms"
});
const httpResp = meter.createCounter("http_server_responses_total");

export function withMetrics(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  res.on("finish", () => {
    const ms = Math.max(0, performance.now() - start);
    const route =
      res.locals?.routeId ||
      (req.route && "path" in req.route ? (req.route.path as string) : undefined) ||
      req.path;
    const status = String(res.statusCode);

    reqDur.record(ms, {
      route,
      method: req.method,
      status
    });
    httpResp.add(1, {
      route,
      method: req.method,
      status
    });
  });

  next();
}
