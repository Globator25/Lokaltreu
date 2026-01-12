// apps/api/src/handlers/admins/refresh.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { issueAccessToken, verifyAccessToken } from "../../auth/admin-jwt.js";
import {
  createRefreshToken,
  hashToken,
  normalizeIp,
  normalizeUa,
  parseBearer,
  problem,
  readJsonBody,
  sendJson,
  sendProblem,
} from "../http-utils.js";
import type { AuditSink, AdminSessionStore } from "./types.js";

export async function handleAdminRefresh(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { sessionStore: AdminSessionStore; auditSink: AuditSink }
) {
  const bearer = parseBearer(req);
  if (!bearer) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Missing bearer token", req.url ?? "/admins/refresh", "TOKEN_EXPIRED")
    );
  }

  const verification = await verifyAccessToken(bearer);
  if (isAccessTokenFailure(verification)) {
    return sendProblem(res, verification.problem);
  }
  const { payload: claims } = verification;

  const body = await readJsonBody(req);
  const refreshToken =
    (body && typeof body["refreshToken"] === "string" ? body["refreshToken"] : null) ?? extractRefreshCookie(req);
  if (!refreshToken) {
    if (!body) {
      return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/refresh"));
    }
    return sendProblem(res, problem(400, "Bad Request", "Missing refresh token", req.url ?? "/admins/refresh"));
  }

  const existing = deps.sessionStore.findByHash(hashToken(refreshToken));
  if (!existing || existing.revokedAt) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Refresh token invalid", req.url ?? "/admins/refresh", "TOKEN_EXPIRED")
    );
  }

  const accessToken = await issueAccessToken({ tenantId: claims.tenantId, adminId: claims.adminId });
  const nextRefresh = createRefreshToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  deps.sessionStore.rotate(hashToken(refreshToken), {
    refreshTokenHash: nextRefresh.hash,
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    expiresAt,
  });

  await Promise.resolve(deps.auditSink.audit({
    event: "admin.token_refresh",
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  }));

  return sendJson(res, 200, {
    accessToken,
    refreshToken: nextRefresh.token,
    expiresIn: 900,
  });
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
