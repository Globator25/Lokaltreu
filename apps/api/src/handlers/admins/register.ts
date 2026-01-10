import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { issueAdminAccessToken, issueAdminRefreshToken } from "../../auth/admin-jwt.js";
import {
  hashToken,
  normalizeIp,
  normalizeUa,
  problem,
  readJsonBody,
  sendJson,
  sendProblem,
} from "../http-utils.js";
import type { AuditSink, AdminSessionStore } from "./types.js";

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function handleAdminRegister(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { sessionStore: AdminSessionStore; auditSink: AuditSink }
) {
  const body = await readJsonBody(req);
  if (!body) {
    return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/register"));
  }
  const email = body["email"];
  const password = body["password"];
  if (typeof email !== "string" || typeof password !== "string") {
    return sendProblem(res, problem(400, "Bad Request", "Missing credentials", req.url ?? "/admins/register"));
  }
  if (password.length < 12) {
    return sendProblem(res, problem(400, "Bad Request", "Password too short", req.url ?? "/admins/register"));
  }

  const tenantId = randomUUID();
  const adminId = randomUUID();

  const accessToken = await issueAdminAccessToken({ sub: adminId, tenantId });
  const refreshToken = await issueAdminRefreshToken({ sub: adminId, tenantId });
  const expiresAt = Date.now() + REFRESH_TTL_SECONDS * 1000;
  deps.sessionStore.create({
    refreshTokenHash: hashToken(refreshToken),
    tenantId,
    adminId,
    expiresAt,
  });

  await Promise.resolve(deps.auditSink.audit({
    event: "admin.register",
    tenantId,
    adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  }));

  res.setHeader(
    "Set-Cookie",
    `AdminRefreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/admins; Max-Age=${REFRESH_TTL_SECONDS}`
  );

  return sendJson(res, 201, {
    adminId,
    tenantId,
    accessToken,
    refreshToken,
    expiresIn: 900,
  });
}
