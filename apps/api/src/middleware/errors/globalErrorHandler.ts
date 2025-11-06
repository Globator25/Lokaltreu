import type { NextFunction, Request, Response } from "express";
import type { Problem } from "@lokaltreu/config";

const canonicalHeaderName = (name: string): string =>
  name
    .split("-")
    .map((part) => (part ? part[0]?.toUpperCase() + part.slice(1).toLowerCase() : part))
    .join("-");

function firstNonEmpty(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parts = value.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
}

function readHeader(req: Request, name: string): string | undefined {
  const candidates = [name, name.toLowerCase(), name.toUpperCase(), canonicalHeaderName(name)];
  const headers = (req.headers ?? {}) as Record<string, unknown>;

  for (const candidate of candidates) {
    const direct = firstNonEmpty(headers[candidate]);
    if (direct) {
      return direct;
    }
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      const normalized = firstNonEmpty(value);
      if (normalized) {
        return normalized;
      }
    }
  }

  const getterCandidates: Array<Request["get"]> = [];
  if (typeof req.get === "function") {
    getterCandidates.push(req.get);
  }
  const headerFn = (req as { header?: Request["get"] }).header;
  if (typeof headerFn === "function" && headerFn !== req.get) {
    getterCandidates.push(headerFn);
  }
  for (const getter of getterCandidates) {
    for (const candidate of candidates) {
      const viaGetter = firstNonEmpty(getter.call(req, candidate));
      if (viaGetter) return viaGetter;
    }
  }

  const rawHeaders = (req as unknown as { rawHeaders?: unknown }).rawHeaders;
  if (Array.isArray(rawHeaders)) {
    for (let index = 0; index < rawHeaders.length - 1; index += 2) {
      const key = String(rawHeaders[index]).toLowerCase();
      if (key === name.toLowerCase()) {
        const value = firstNonEmpty(rawHeaders[index + 1]);
        if (value) {
          return value;
        }
      }
    }
  }

  return undefined;
}

export function globalErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if ((res as Response).headersSent) {
    next(err);
    return;
  }

  const reqIdFallback =
    readHeader(req, "x-request-id") ??
    ((): string | undefined => {
      const withId = req as Request & { id?: string | undefined };
      if (typeof withId.id === "string") {
        const trimmed = withId.id.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    })();
  const requestId = reqIdFallback ?? "unknown-request";
  const correlationId = readHeader(req, "x-correlation-id") ?? requestId;
  const detail = err instanceof Error ? err.message : String(err);

  console.error("[unhandled-error]", {
    correlationId,
    path: req.path,
    method: req.method,
    error: detail,
  });

  const base: Problem = {
    type: "about:blank",
    title: "INTERNAL_SERVER_ERROR",
    status: 500,
    detail,
  };
  const body = {
    ...base,
    type: "https://errors.lokaltreu.example/internal",
    correlation_id: correlationId,
    error_code: "INTERNAL_SERVER_ERROR",
    requestId,
  };

  res
    .status(base.status)
    .type("application/problem+json")
    .json(body);
}
