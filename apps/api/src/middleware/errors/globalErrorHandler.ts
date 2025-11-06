import type { NextFunction, Request, Response } from "express";
import { createInternalServerErrorProblem } from "@lokaltreu/types";

function readHeader(req: Request, name: string): string | undefined {
  const getFn = (req as any).get;
  const viaGet = typeof getFn === "function" ? getFn.call(req, name) : undefined;
  if (viaGet && viaGet.trim().length > 0) return viaGet;

  const h = req.headers ?? {};
  const raw = (h[name.toLowerCase()] ?? (h as any)[name]) as string | string[] | undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = readHeader(req, "x-request-id") ?? "unknown-request";
  const correlationId = readHeader(req, "x-correlation-id") ?? requestId;

  console.error("[unhandled-error]", {
    correlationId,
    path: req.path,
    method: req.method,
    error: err?.message,
  });

  res
    .status(500)
    .type("application/problem+json")
    .json(createInternalServerErrorProblem(requestId, correlationId, err?.message));
}
