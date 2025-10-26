import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function withCorrelation(req: Request, res: Response, next: NextFunction) {
  const headerValue =
    (req.headers["x-correlation-id"] as string | undefined) ||
    (req.headers["x-request-id"] as string | undefined);
  const correlationId = (headerValue ?? randomUUID()).toString();

  res.locals.correlation_id = correlationId;
  res.locals.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);

  next();
}
