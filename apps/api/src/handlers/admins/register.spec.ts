import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../http-utils.js";
import type { AdminSessionStore, AuditSink } from "./types.js";

vi.mock("../../auth/admin-jwt.js", () => ({
  issueAdminAccessToken: vi.fn(),
  issueAdminRefreshToken: vi.fn(),
}));

import { issueAdminAccessToken, issueAdminRefreshToken } from "../../auth/admin-jwt.js";

type ServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
};

async function startServer(deps: { sessionStore: AdminSessionStore; auditSink: AuditSink }): Promise<ServerHandle> {
  const { handleAdminRegister } = await import("./register.js");
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url?.split("?")[0] === "/admins/register") {
      void handleAdminRegister(req, res, deps);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("handleAdminRegister", () => {
  let handle: ServerHandle | null = null;

  afterEach(async () => {
    vi.resetAllMocks();
    if (handle) {
      await new Promise<void>((resolve) => handle?.server.close(() => resolve()));
      handle = null;
    }
  });

  it("returns 400 for invalid JSON body", async () => {
    const sessionStore: AdminSessionStore = { create: vi.fn(), findByHash: vi.fn(), rotate: vi.fn(), revoke: vi.fn() };
    const auditSink: AuditSink = { audit: vi.fn() };
    handle = await startServer({ sessionStore, auditSink });

    const res = await fetch(`${handle.baseUrl}/admins/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.detail).toBe("Invalid JSON body");
  });

  it("returns 400 for missing credentials", async () => {
    const sessionStore: AdminSessionStore = { create: vi.fn(), findByHash: vi.fn(), rotate: vi.fn(), revoke: vi.fn() };
    const auditSink: AuditSink = { audit: vi.fn() };
    handle = await startServer({ sessionStore, auditSink });

    const res = await fetch(`${handle.baseUrl}/admins/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.detail).toBe("Missing credentials");
  });

  it("returns 400 for short passwords", async () => {
    const sessionStore: AdminSessionStore = { create: vi.fn(), findByHash: vi.fn(), rotate: vi.fn(), revoke: vi.fn() };
    const auditSink: AuditSink = { audit: vi.fn() };
    handle = await startServer({ sessionStore, auditSink });

    const res = await fetch(`${handle.baseUrl}/admins/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "short" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.detail).toBe("Password too short");
  });

  it("registers admin and returns tokens", async () => {
    const sessionStore: AdminSessionStore = { create: vi.fn(), findByHash: vi.fn(), rotate: vi.fn(), revoke: vi.fn() };
    const auditSink: AuditSink = { audit: vi.fn() };
    const createSpy = vi.spyOn(sessionStore, "create");
    const auditSpy = vi.spyOn(auditSink, "audit");
    handle = await startServer({ sessionStore, auditSink });

    const accessTokenMock = vi.mocked(issueAdminAccessToken);
    const refreshTokenMock = vi.mocked(issueAdminRefreshToken);
    accessTokenMock.mockResolvedValueOnce("access-token");
    refreshTokenMock.mockResolvedValueOnce("refresh-token");

    const res = await fetch(`${handle.baseUrl}/admins/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
      },
      body: JSON.stringify({ email: "owner@example.com", password: "long-enough-password" }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.accessToken).toBe("access-token");
    expect(body.refreshToken).toBe("refresh-token");
    expect(body.adminId).toBeDefined();
    expect(body.tenantId).toBeDefined();
    expect(res.headers.get("set-cookie")).toContain("AdminRefreshToken=refresh-token");

    expect(createSpy).toHaveBeenCalledTimes(1);
    const sessionArg = createSpy.mock.calls[0]?.[0];
    expect(sessionArg?.refreshTokenHash).toBe(hashToken("refresh-token"));
    expect(sessionArg?.tenantId).toBe(body.tenantId);
    expect(sessionArg?.adminId).toBe(body.adminId);
    expect(sessionArg?.expiresAt).toBeTypeOf("number");

    expect(auditSpy).toHaveBeenCalledTimes(1);
    const auditArg = auditSpy.mock.calls[0]?.[0];
    expect(auditArg?.event).toBe("admin.register");
    expect(auditArg?.tenantId).toBe(body.tenantId);
    expect(auditArg?.adminId).toBe(body.adminId);
  });
});
