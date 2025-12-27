// Minimaler HTTP-Server für Admin-Auth (Schritt 14).
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { handleAdminLogin } from "./handlers/admins/login.js";
import { handleAdminLogout } from "./handlers/admins/logout.js";
import { handleAdminRefresh } from "./handlers/admins/refresh.js";
import { handleAdminRegister } from "./handlers/admins/register.js";
import { handleGetJwks } from "./handlers/jwks/get-jwks.js";
import type { AdminSession, AdminSessionStore, AuditEvent, AuditSink } from "./handlers/admins/types.js";
import { problem, sendProblem } from "./handlers/http-utils.js";
import { createDeviceAuthMiddleware } from "./middleware/device-auth.js";
import { InMemoryDeviceReplayStore } from "./modules/auth/device-replay-store.js";
import { InMemoryDeviceRepository } from "./modules/auth/device-repository.js";

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

class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  audit(event: AuditEvent): void {
    this.events.push(event);
  }
}

export function createAppServer() {
  const sessionStore = new InMemoryAdminSessionStore();
  const auditSink = new InMemoryAuditSink();
  const deviceRepository = new InMemoryDeviceRepository();
  const replayStore = new InMemoryDeviceReplayStore();
  const deviceAuth = createDeviceAuthMiddleware({ deviceRepository, replayStore });

  async function requireDeviceAuth(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<boolean> {
    let allowed = false;
    await deviceAuth(req, res, () => {
      allowed = true;
    });
    return allowed;
  }

  async function handleRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) {
    try {
      const path = req.url?.split("?")[0] ?? "/";
      const requiresDeviceAuth =
        req.method === "POST" && (path === "/stamps/tokens" || path === "/stamps/claim" || path === "/rewards/redeem");
      if (requiresDeviceAuth) {
        const allowed = await requireDeviceAuth(req, res);
        if (!allowed) {
          return;
        }
      }
      if (req.method === "POST" && path === "/admins/login") {
        await handleAdminLogin(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/register") {
        await handleAdminRegister(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/refresh") {
        await handleAdminRefresh(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/logout") {
        await handleAdminLogout(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "GET" && path === "/.well-known/jwks.json") {
        handleGetJwks(req, res);
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

export async function startServer(port: number) {
  const { server } = createAppServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    const maybeServer = server as typeof server & {
      once?: (event: string, listener: (error: Error) => void) => void;
      off?: (event: string, listener: (error: Error) => void) => void;
    };
    const onError = (error: Error) => {
      if (typeof maybeServer.off === "function") {
        maybeServer.off("error", onError);
      }
      rejectListen(error);
    };

    if (typeof maybeServer.once === "function") {
      maybeServer.once("error", onError);
    }

    try {
      server.listen(port, () => {
        if (typeof maybeServer.off === "function") {
          maybeServer.off("error", onError);
        }
        resolveListen();
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Failed to start server"));
    }
  });
  return server;
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  startServer(port)
    .then(() => {
      console.warn("Lokaltreu API startet...");
    })
    .catch((err) => {
      console.error("Failed to start Lokaltreu API", err);
      process.exit(1);
    });
}
