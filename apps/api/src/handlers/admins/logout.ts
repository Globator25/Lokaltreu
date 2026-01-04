// apps/api/src/handlers/admins/logout.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { verifyAccessToken } from "../../auth/admin-jwt.js";
import { hashToken, normalizeIp, normalizeUa, parseBearer, problem, readJsonBody, sendProblem } from "../http-utils.js";
import type { AuditSink, AdminSessionStore } from "./types.js";

export async function handleAdminLogout(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { sessionStore: AdminSessionStore; auditSink: AuditSink }
) {
  const bearer = parseBearer(req);
  if (!bearer) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Missing bearer token", req.url ?? "/admins/logout", "TOKEN_EXPIRED")
    );
  }

  const verification = await verifyAccessToken(bearer);
  if (isAccessTokenFailure(verification)) {
    return sendProblem(res, verification.problem);
  }
  const claims = verification.payload;

  const body = await readJsonBody(req);
  const refreshToken =
    (body && typeof body["refreshToken"] === "string" ? body["refreshToken"] : null) ?? extractRefreshCookie(req);
  if (!refreshToken) {
    if (!body) {
      return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/logout"));
    }
    return sendProblem(res, problem(400, "Bad Request", "Missing refresh token", req.url ?? "/admins/logout"));
  }

  deps.sessionStore.revoke(hashToken(refreshToken));

  deps.auditSink.audit({
    event: "admin.logout",
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  });

  res.statusCode = 204;
  res.setHeader(
    "Set-Cookie",
    "AdminRefreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/admins; Max-Age=0"
  );
  res.end();
}

type AccessTokenVerification = Awaited<ReturnType<typeof verifyAccessToken>>;
type AccessTokenFailure = Extract<AccessTokenVerification, { ok: false }>;

function isAccessTokenFailure(verification: AccessTokenVerification): verification is AccessTokenFailure {
  return verification.ok === false;
}

function extractRefreshCookie(req: IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const entries = header.split(";").map((part) => part.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [name, ...rest] = entry.split("=");
    if (name === "AdminRefreshToken") {
      return rest.join("=");
    }
  }
  return null;
}
