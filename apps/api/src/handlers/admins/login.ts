// apps/api/src/handlers/admins/login.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { issueAccessToken } from "../../auth/admin-jwt.js";
import { createRefreshToken, normalizeIp, normalizeUa, problem, readJsonBody, sendJson, sendProblem } from "../http-utils.js";
import type { AuditSink, AdminSessionStore } from "./types.js";

export async function handleAdminLogin(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { sessionStore: AdminSessionStore; auditSink: AuditSink }
) {
  const body = await readJsonBody(req);
  if (!body) {
    return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/login"));
  }
  const email = body["email"];
  const password = body["password"];
  if (typeof email !== "string" || typeof password !== "string") {
    return sendProblem(res, problem(400, "Bad Request", "Missing credentials", req.url ?? "/admins/login"));
  }

  // TODO: Ersetze durch echte Credential-Pruefung + User-Store.
  const tenantId = randomUUID();
  const adminId = randomUUID();
  const accessToken = await issueAccessToken({ tenantId, adminId });
  const refresh = createRefreshToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  deps.sessionStore.create({
    refreshTokenHash: refresh.hash,
    tenantId,
    adminId,
    expiresAt,
  });

  await Promise.resolve(deps.auditSink.audit({
    event: "admin.login",
    tenantId,
    adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  }));

  return sendJson(res, 200, {
    accessToken,
    refreshToken: refresh.token,
    expiresIn: 900,
  });
}
