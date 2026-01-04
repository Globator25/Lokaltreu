import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { verifyAdminJwt, ProblemError } from "../modules/auth/keystore.js";

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
};

export type AdminAuthContext = {
  tenantId: string;
  adminId: string;
  token: string;
  expiresAt: number;
};

export type AdminAuthRequest = IncomingMessage & {
  context?: {
    admin?: AdminAuthContext;
  };
};

function problem(
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

function sendProblem(res: ServerResponse, payload: ProblemDetails) {
  res.statusCode = payload.status;
  res.setHeader("Content-Type", "application/problem+json");
  res.end(JSON.stringify(payload));
}

function parseBearer(req: IncomingMessage): string | null {
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

export async function requireAdminAuth(req: AdminAuthRequest, res: ServerResponse): Promise<boolean> {
  const token = parseBearer(req);
  if (!token) {
    sendProblem(res, problem(401, "Unauthorized", "Missing bearer token", req.url ?? "/", "TOKEN_EXPIRED"));
    return false;
  }

  try {
    const { payload } = await verifyAdminJwt(token);
    const tenantId = payload["tenant_id"];
    const adminId = payload.sub;
    const exp = payload.exp;

    if (typeof tenantId !== "string" || typeof adminId !== "string") {
      sendProblem(res, problem(403, "Forbidden", "Missing token claims", req.url ?? "/"));
      return false;
    }
    if (typeof exp !== "number") {
      sendProblem(res, problem(403, "Forbidden", "Missing token expiry", req.url ?? "/"));
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (exp <= now) {
      sendProblem(res, problem(401, "Unauthorized", "Token expired", req.url ?? "/", "TOKEN_EXPIRED"));
      return false;
    }

    req.context = {
      ...(req.context ?? {}),
      admin: {
        tenantId,
        adminId,
        token,
        expiresAt: exp,
      },
    };
    return true;
  } catch (err: unknown) {
    if (err instanceof ProblemError) {
      sendProblem(res, err.details);
      return false;
    }
    sendProblem(res, problem(401, "Unauthorized", "Invalid token", req.url ?? "/", "TOKEN_REUSE"));
    return false;
  }
}
