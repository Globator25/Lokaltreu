import type { NextFunction, Request, Response } from "express";
import { createInternalServerErrorProblem } from "@lokaltreu/types";

export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId =
    typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "unknown-request";
  const correlationHeader = req.headers["x-correlation-id"];
  const correlationId =
    typeof correlationHeader === "string" && correlationHeader.trim().length > 0 ? correlationHeader : requestId;

  console.error("[unhandled-error]", {
    correlationId,
    path: req.path,
    method: req.method,
    error: err?.message,
  });

  res
    .status(500)
    .type("application/problem+json")
    .json(createInternalServerErrorProblem(requestId, err?.message));
}
