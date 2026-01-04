import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
};

export function problem(
  status: number,
  title: string,
  detail: string,
  instance: string,
  error_code?: string
): ProblemDetails {
  return {
    type: `https://errors.lokaltreu.example/${error_code || "request"}`,
    title,
    status,
    detail,
    instance,
    error_code,
    correlation_id: randomUUID(),
  };
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function sendProblem(res: ServerResponse, payload: ProblemDetails) {
  res.statusCode = payload.status;
  res.setHeader("Content-Type", "application/problem+json");
  res.end(JSON.stringify(payload));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else if (chunk instanceof Buffer) {
      chunks.push(chunk);
    }
  }
  if (chunks.length === 0) {
    return null;
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseBearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = `${randomUUID()}-${randomBytes(16).toString("hex")}`;
  return { token, hash: hashToken(token) };
}

export function normalizeIp(req: IncomingMessage): string | undefined {
  const ip = req.socket.remoteAddress;
  return ip || undefined;
}

export function normalizeUa(req: IncomingMessage): string | undefined {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : undefined;
}
