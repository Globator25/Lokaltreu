import type { Request, Response, NextFunction } from "express";
import { getLog } from "../observability/logging";

export function logRequests(req: Request, res: Response, next: NextFunction) {
  const start = performance.now(); // Node 18+ hat performance global
  res.on("finish", () => {
    const ms = Math.max(0, performance.now() - start);
    const route =
      res.locals?.routeId ||
      (req.route?.path ? (req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path) : req.path);
    getLog().info(
      {
        route,
        method: req.method,
        status: String(res.statusCode),
        duration_ms: Math.round(ms),
        tenant_id: res.locals?.tenantId,               // pseudonym, kein PII
        correlation_id: res.locals?.correlationId,     // für Korrelation/Fehler
      },
      "http_request_done"
    );
  });
  next();
}
