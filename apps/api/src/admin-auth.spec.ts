import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeJwt, exportJWK, generateKeyPair } from "jose";
import { issueAccessToken, verifyAccessToken, resetAdminJwtCache } from "./auth/admin-jwt.js";
import { createAppServer } from "./index.js";

const ISSUER = "lokaltreu-admin";
const AUDIENCE = "lokaltreu-api";
let envSnapshot: NodeJS.ProcessEnv;

async function setJwksEnv(kid: string) {
  const { privateKey } = await generateKeyPair("EdDSA");
  const privateJwk = await exportJWK(privateKey);
  privateJwk.kid = kid;
  privateJwk.alg = "EdDSA";
  process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [privateJwk] });
  process.env.ADMIN_JWT_ACTIVE_KID = kid;
  process.env.ADMIN_JWT_ISS = ISSUER;
  process.env.ADMIN_JWT_AUD = AUDIENCE;
}

async function startServer() {
  const { server, auditSink } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, auditSink, baseUrl };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string for ${key}`);
  }
  return value;
}

function getNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number for ${key}`);
  }
  return value;
}

function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const value = obj[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array for ${key}`);
  }
  return value;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error("Expected JSON object");
  }
  return data;
}

async function requestJson(baseUrl: string, path: string, init: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const contentType = res.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") || contentType.includes("application/problem+json")
      ? await readJson(res)
      : null;
  return { res, body, contentType };
}

describe("admin-jwt", () => {
  beforeEach(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("kid-A");
    resetAdminJwtCache();
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("issues access token with exp-iat <= 900s", async () => {
    const token = await issueAccessToken({ tenantId: "tenant-1", adminId: "admin-1" });
    const payloadUnknown: unknown = decodeJwt(token);
    if (!isRecord(payloadUnknown)) {
      throw new Error("Expected JWT payload object");
    }
    const iat = getNumber(payloadUnknown, "iat");
    const exp = getNumber(payloadUnknown, "exp");
    expect(exp - iat).toBeLessThanOrEqual(900);
  });

  it("verifies a valid access token", async () => {
    const token = await issueAccessToken({ tenantId: "tenant-2", adminId: "admin-2" });
    const verified = await verifyAccessToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.tenantId).toBe("tenant-2");
      expect(verified.payload.adminId).toBe("admin-2");
    }
  });

  it("rejects token when kid is not in JWKS (rotation)", async () => {
    const token = await issueAccessToken({ tenantId: "tenant-3", adminId: "admin-3" });
    await setJwksEnv("kid-B");
    resetAdminJwtCache();
    const result = await verifyAccessToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(401);
    }
  });
});

describe("admin auth endpoints", () => {
  beforeEach(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("kid-B");
    resetAdminJwtCache();
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("login/refresh/logout flow with audit events and RFC7807 errors", async () => {
    const { server, auditSink, baseUrl } = await startServer();
    try {
    const login = await requestJson(baseUrl, "/admins/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.invalid", password: "example-password-123" }),
    });
    expect(login.res.status).toBe(200);
    if (!login.body) {
      throw new Error("Expected login body");
    }
    const loginAccess = getString(login.body, "accessToken");
    const loginRefresh = getString(login.body, "refreshToken");
    expect(loginAccess).toBeTruthy();
    expect(loginRefresh).toBeTruthy();
    expect(auditSink.events.filter((e) => e.event === "admin.login")).toHaveLength(1);

    const refresh = await requestJson(baseUrl, "/admins/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginAccess}`,
      },
      body: JSON.stringify({ refreshToken: loginRefresh }),
    });
    expect(refresh.res.status).toBe(200);
    if (!refresh.body) {
      throw new Error("Expected refresh body");
    }
    const rotatedRefresh = getString(refresh.body, "refreshToken");
    expect(rotatedRefresh).toBeTruthy();
    expect(rotatedRefresh).not.toBe(loginRefresh);
    expect(auditSink.events.filter((e) => e.event === "admin.token_refresh")).toHaveLength(1);

    const logout = await requestJson(baseUrl, "/admins/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginAccess}`,
      },
      body: JSON.stringify({ refreshToken: rotatedRefresh }),
    });
    expect(logout.res.status).toBe(204);
    expect(auditSink.events.filter((e) => e.event === "admin.logout")).toHaveLength(1);

    const refreshOld = await requestJson(baseUrl, "/admins/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginAccess}`,
      },
      body: JSON.stringify({ refreshToken: loginRefresh }),
    });
    expect(refreshOld.res.status).toBe(401);
    expect(refreshOld.contentType).toContain("application/problem+json");
    if (!refreshOld.body) {
      throw new Error("Expected error body");
    }
    expect(getNumber(refreshOld.body, "status")).toBe(401);
    expect(getString(refreshOld.body, "title")).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("serves public JWKS without private fields", async () => {
    const { server, baseUrl } = await startServer();
    try {
    const jwks = await requestJson(baseUrl, "/.well-known/jwks.json", { method: "GET" });
    expect(jwks.res.status).toBe(200);
    if (!jwks.body) {
      throw new Error("Expected JWKS body");
    }
    const keys = getArray(jwks.body, "keys");
    expect(keys.length).toBeGreaterThan(0);
    const firstKey = keys[0];
    if (!isRecord(firstKey)) {
      throw new Error("Expected JWKS key object");
    }
    expect(firstKey.d).toBeUndefined();
    expect(firstKey.p).toBeUndefined();
    expect(firstKey.q).toBeUndefined();
    expect(firstKey.dp).toBeUndefined();
    expect(firstKey.dq).toBeUndefined();
    expect(firstKey.qi).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
