import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function withCorrelation(req: Request, res: Response, next: NextFunction) {
  const hdr = (req.headers["x-correlation-id"] || req.headers["x-request-id"]) as string | undefined;
  res.locals.correlationId = hdr?.toString() || randomUUID().replace(/-/g, "");
  next();
}
