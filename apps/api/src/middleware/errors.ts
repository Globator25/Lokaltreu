import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { logError } from "../observability/logging";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const locals = (res.locals ??= {});
  const correlation_id =
    locals.correlation_id ?? locals.correlationId ?? randomUUID().replace(/-/g, "");
  locals.correlation_id = correlation_id;
  res.setHeader("x-correlation-id", correlation_id);
  const status = err?.status ?? 500;

  logError("request_failed", { correlation_id, err });

  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: err?.type ?? "about:blank",
      title: err?.title ?? "Internal Server Error",
      status,
      detail: err?.detail ?? "unexpected error",
      correlation_id
    });
}
