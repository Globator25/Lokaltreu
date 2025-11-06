import type { Request } from "express";
import type { IncomingHttpHeaders } from "node:http";

type MakeRequestOptions = {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  ip?: string;
  extras?: Partial<Request>;
};

export function makeRequest(options: MakeRequestOptions = {}): Request {
  const { method = "GET", path = "/", headers = {}, ip, extras } = options;

  const normalizedEntries = Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]);
  const normalizedHeaders = Object.fromEntries(normalizedEntries) as IncomingHttpHeaders;

  const req = {} as Request & { headers: IncomingHttpHeaders };
  Object.assign(req as unknown as Record<string, unknown>, { method, path });
  req.headers = normalizedHeaders;

  req.get = ((name: string) => {
    const key = name.toLowerCase();
    const value = normalizedHeaders[key] ?? headers[name];
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
      return first;
    }
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }) as Request["get"];

  req.header = req.get;

  if (typeof ip === "string") {
    (req as unknown as Record<string, unknown>).ip = ip;
  }

  if (extras) {
    Object.assign(req, extras);
  }

  return req;
}


