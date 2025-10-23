import type { Request, Response, NextFunction } from "express";
import { logInfo } from "../observability/logging";

export function logRequests(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  res.on("finish", () => {
    const ms = Math.max(0, performance.now() - start);
    const route =
      res.locals?.routeId ||
      (req.route?.path
        ? req.baseUrl
          ? `${req.baseUrl}${req.route.path}`
          : req.route.path
        : req.path);

    logInfo("http_request_done", {
      route,
      method: req.method,
      status: String(res.statusCode),
      duration_ms: Math.round(ms),
      tenant_id: res.locals?.tenantId,
      correlation_id: res.locals?.correlation_id ?? res.locals?.correlationId
    });
  });
  next();
}
