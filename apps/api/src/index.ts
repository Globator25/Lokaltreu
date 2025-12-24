// Minimaler HTTP-Server für Admin-Auth (Schritt 14).
import { createServer } from "node:http";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { issueAccessToken, verifyAccessToken, getPublicJwks } from "./auth/admin-jwt.js";

const PORT = Number(process.env.PORT || 3000);

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  correlation_id?: string;
};

type AdminSession = {
  refreshTokenHash: string;
  tenantId: string;
  adminId: string;
  expiresAt: number;
  revokedAt?: number;
  rotatedAt?: number;
};

interface AdminSessionStore {
  create(session: AdminSession): void;
  findByHash(refreshTokenHash: string): AdminSession | undefined;
  rotate(refreshTokenHash: string, next: AdminSession): void;
  revoke(refreshTokenHash: string): void;
}

class InMemoryAdminSessionStore implements AdminSessionStore {
  private readonly sessions = new Map<string, AdminSession>();

  create(session: AdminSession): void {
    this.sessions.set(session.refreshTokenHash, session);
  }

  findByHash(refreshTokenHash: string): AdminSession | undefined {
    return this.sessions.get(refreshTokenHash);
  }

  rotate(refreshTokenHash: string, next: AdminSession): void {
    const existing = this.sessions.get(refreshTokenHash);
    if (existing) {
      existing.revokedAt = Date.now();
      existing.rotatedAt = Date.now();
    }
    this.sessions.set(next.refreshTokenHash, next);
  }

  revoke(refreshTokenHash: string): void {
    const existing = this.sessions.get(refreshTokenHash);
    if (existing) {
      existing.revokedAt = Date.now();
    }
  }
}

type AuditEvent = {
  event: "admin.login" | "admin.token_refresh" | "admin.logout";
  tenantId: string;
  adminId: string;
  correlationId: string;
  ip?: string;
  ua?: string;
  at: number;
};

interface AuditSink {
  audit(event: AuditEvent): void;
}

class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  audit(event: AuditEvent): void {
    this.events.push(event);
  }
}

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

function sendJson(res: import("node:http").ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendProblem(res: import("node:http").ServerResponse, payload: ProblemDetails) {
  res.statusCode = payload.status;
  res.setHeader("Content-Type", "application/problem+json");
  res.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(
  req: import("node:http").IncomingMessage
): Promise<Record<string, unknown> | null> {
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

function parseBearer(req: import("node:http").IncomingMessage): string | null {
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

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createRefreshToken(): { token: string; hash: string } {
  const token = `${randomUUID()}-${randomBytes(16).toString("hex")}`;
  return { token, hash: hashToken(token) };
}

function normalizeIp(req: import("node:http").IncomingMessage): string | undefined {
  const ip = req.socket.remoteAddress;
  return ip || undefined;
}

function normalizeUa(req: import("node:http").IncomingMessage): string | undefined {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : undefined;
}

export function createAppServer() {
  const sessionStore = new InMemoryAdminSessionStore();
  const auditSink = new InMemoryAuditSink();

  async function handleLogin(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
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
  sessionStore.create({
    refreshTokenHash: refresh.hash,
    tenantId,
    adminId,
    expiresAt,
  });

  auditSink.audit({
    event: "admin.login",
    tenantId,
    adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  });

  return sendJson(res, 200, {
    accessToken,
    refreshToken: refresh.token,
    expiresIn: 900,
  });
}

  async function handleRefresh(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) {
  const bearer = parseBearer(req);
  if (!bearer) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Missing bearer token", req.url ?? "/admins/refresh", "TOKEN_EXPIRED")
    );
  }

  const verification = await verifyAccessToken(bearer);
  if (!verification.ok) {
    return sendProblem(res, verification.problem);
  }
  const claims = verification.payload;

  const body = await readJsonBody(req);
  if (!body) {
    return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/refresh"));
  }
  const refreshToken = body["refreshToken"];
  if (typeof refreshToken !== "string") {
    return sendProblem(res, problem(400, "Bad Request", "Missing refresh token", req.url ?? "/admins/refresh"));
  }

  const existing = sessionStore.findByHash(hashToken(refreshToken));
  if (!existing || existing.revokedAt) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Refresh token invalid", req.url ?? "/admins/refresh", "TOKEN_EXPIRED")
    );
  }

  const accessToken = await issueAccessToken({ tenantId: claims.tenantId, adminId: claims.adminId });
  const nextRefresh = createRefreshToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  sessionStore.rotate(hashToken(refreshToken), {
    refreshTokenHash: nextRefresh.hash,
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    expiresAt,
  });

  auditSink.audit({
    event: "admin.token_refresh",
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  });

  return sendJson(res, 200, {
    accessToken,
    refreshToken: nextRefresh.token,
    expiresIn: 900,
  });
}

  async function handleLogout(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) {
  const bearer = parseBearer(req);
  if (!bearer) {
    return sendProblem(
      res,
      problem(401, "Unauthorized", "Missing bearer token", req.url ?? "/admins/logout", "TOKEN_EXPIRED")
    );
  }

  const verification = await verifyAccessToken(bearer);
  if (!verification.ok) {
    return sendProblem(res, verification.problem);
  }
  const claims = verification.payload;

  const body = await readJsonBody(req);
  if (!body) {
    return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/admins/logout"));
  }
  const refreshToken = body["refreshToken"];
  if (typeof refreshToken !== "string") {
    return sendProblem(res, problem(400, "Bad Request", "Missing refresh token", req.url ?? "/admins/logout"));
  }

  sessionStore.revoke(hashToken(refreshToken));

  auditSink.audit({
    event: "admin.logout",
    tenantId: claims.tenantId,
    adminId: claims.adminId,
    correlationId: randomUUID(),
    ip: normalizeIp(req),
    ua: normalizeUa(req),
    at: Date.now(),
  });

  res.statusCode = 204;
  res.end();
}

  function handleJwks(res: import("node:http").ServerResponse) {
    const jwks = getPublicJwks();
    return sendJson(res, 200, jwks);
  }

  async function handleRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) {
    try {
      const path = req.url?.split("?")[0] ?? "/";
      if (req.method === "POST" && path === "/admins/login") {
        await handleLogin(req, res);
        return;
      }
      if (req.method === "POST" && path === "/admins/refresh") {
        await handleRefresh(req, res);
        return;
      }
      if (req.method === "POST" && path === "/admins/logout") {
        await handleLogout(req, res);
        return;
      }
      if (req.method === "GET" && path === "/.well-known/jwks.json") {
        handleJwks(res);
        return;
      }

      sendProblem(res, problem(404, "Not Found", "Route not found", path, "TOKEN_REUSE"));
    } catch {
      sendProblem(
        res,
        problem(500, "Internal Server Error", "Unexpected error", req.url ?? "/", "TOKEN_REUSE")
      );
    }
  }

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  return { server, auditSink, sessionStore };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const { server } = createAppServer();
  server.listen(PORT, () => {
    console.warn(`Lokaltreu API listening on ${PORT}`);
  });
}
