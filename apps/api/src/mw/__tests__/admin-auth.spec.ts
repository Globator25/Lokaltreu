import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../admin-auth.js";

const verifyAdminJwt = vi.fn();

class ProblemError extends Error {
  details: {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    error_code?: string;
    correlation_id?: string;
  };

  constructor(details: ProblemError["details"]) {
    super(details.title);
    this.details = details;
  }
}

vi.mock("../../modules/auth/keystore.js", () => ({
  verifyAdminJwt,
  ProblemError,
}));

let requireAdminAuth: typeof import("../admin-auth.js").requireAdminAuth;

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error("Expected JSON object");
  }
  return data;
}

async function startServer(): Promise<ServerHandle> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const ok = await requireAdminAuth(req as AdminAuthRequest, res);
      if (!ok) {
        return;
      }
      const admin = (req as AdminAuthRequest).context?.admin;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, adminId: admin?.adminId, tenantId: admin?.tenantId }));
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("admin-auth middleware", () => {
  let serverHandle: ServerHandle | null = null;

  beforeAll(async () => {
    const mod = await import("../admin-auth.js");
    requireAdminAuth = mod.requireAdminAuth;
  });

  afterEach(async () => {
    verifyAdminJwt.mockReset();
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("allows requests with a valid admin token", async () => {
    const now = Math.floor(Date.now() / 1000);
    verifyAdminJwt.mockResolvedValue({
      payload: { tenant_id: "tenant-1", sub: "admin-1", exp: now + 60 },
    });
    serverHandle = await startServer();
    const res = await fetch(serverHandle.baseUrl, {
      headers: { authorization: "Bearer good-token" },
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tenantId).toBe("tenant-1");
    expect(body.adminId).toBe("admin-1");
  });

  it("returns 401 when the bearer token is missing", async () => {
    serverHandle = await startServer();
    const res = await fetch(serverHandle.baseUrl);
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("TOKEN_EXPIRED");
    expect(typeof body.correlation_id).toBe("string");
  });

  it("returns 401 when the bearer token is invalid", async () => {
    verifyAdminJwt.mockRejectedValue(
      new ProblemError({
        type: "https://errors.lokaltreu.example/auth/token-invalid",
        title: "Token invalid",
        status: 401,
        error_code: "TOKEN_REUSE",
        correlation_id: "corr-1",
      })
    );
    serverHandle = await startServer();
    const res = await fetch(serverHandle.baseUrl, {
      headers: { authorization: "Bearer bad-token" },
    });
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.error_code).toBe("TOKEN_REUSE");
    expect(typeof body.correlation_id).toBe("string");
  });

  it("returns 403 when token claims are missing", async () => {
    const now = Math.floor(Date.now() / 1000);
    verifyAdminJwt.mockResolvedValue({
      payload: { sub: "admin-1", exp: now + 60 },
    });
    serverHandle = await startServer();
    const res = await fetch(serverHandle.baseUrl, {
      headers: { authorization: "Bearer missing-claims" },
    });
    const body = await readJson(res);
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(body.title).toBe("Forbidden");
    expect(typeof body.correlation_id).toBe("string");
  });
});
