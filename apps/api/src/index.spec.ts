import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { createAppServer } from "./index.js";
import { issueAccessToken, resetAdminJwtCache } from "./auth/admin-jwt.js";

let envSnapshot: NodeJS.ProcessEnv;

async function setValidJwksEnv(kid: string) {
  const { privateKey } = await generateKeyPair("EdDSA");
  const privateJwk = await exportJWK(privateKey);
  privateJwk.kid = kid;
  privateJwk.alg = "EdDSA";
  process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [privateJwk] });
  process.env.ADMIN_JWT_ACTIVE_KID = kid;
  process.env.ADMIN_JWT_ISS = "lokaltreu-admin";
  process.env.ADMIN_JWT_AUD = "lokaltreu-api";
  resetAdminJwtCache();
}

async function startServer() {
  const { server } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

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

describe("index.ts HTTP server", () => {
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("serves JWKS on /.well-known/jwks.json", async () => {
    await setValidJwksEnv("kid-jwks");
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
      const body = await readJson(res);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      const keys = getArray(body, "keys");
      expect(keys.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 401 Problem+JSON for protected route without token", async () => {
    await setValidJwksEnv("kid-protected");
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/refresh`, { method: "POST" });
      const body = await readJson(res);
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 404 Problem+JSON for unknown routes", async () => {
    await setValidJwksEnv("kid-404");
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/unknown-route`, { method: "GET" });
      const body = await readJson(res);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 Problem+JSON when refresh payload is not valid JSON", async () => {
    await setValidJwksEnv("kid-refresh-bad-json");
    const accessToken = await issueAccessToken({ tenantId: "tenant-refresh", adminId: "admin-refresh" });
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/refresh`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: "not-json",
      });
      const body = await readJson(res);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(400);
      expect(body.detail).toBe("Invalid JSON body");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 Problem+JSON when refresh token is missing", async () => {
    await setValidJwksEnv("kid-refresh-missing-token");
    const accessToken = await issueAccessToken({ tenantId: "tenant-refresh", adminId: "admin-refresh" });
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/refresh`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await readJson(res);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(400);
      expect(body.detail).toBe("Missing refresh token");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 401 Problem+JSON for logout without bearer token", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/logout`, { method: "POST" });
      const body = await readJson(res);
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(401);
      expect(body.detail).toBe("Missing bearer token");
      expect(body.error_code).toBe("TOKEN_EXPIRED");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 401 Problem+JSON for logout with invalid access token", async () => {
    await setValidJwksEnv("kid-logout-invalid");
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/logout`, {
        method: "POST",
        headers: {
          authorization: "Bearer invalid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      });
      const body = await readJson(res);
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(401);
      expect(body.error_code).toBe("TOKEN_REUSE");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 Problem+JSON when logout payload is not valid JSON", async () => {
    await setValidJwksEnv("kid-logout-bad-json");
    const accessToken = await issueAccessToken({ tenantId: "tenant-logout", adminId: "admin-logout" });
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: "not-json",
      });
      const body = await readJson(res);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(400);
      expect(body.detail).toBe("Invalid JSON body");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 Problem+JSON when logout refresh token is missing", async () => {
    await setValidJwksEnv("kid-logout-missing-token");
    const accessToken = await issueAccessToken({ tenantId: "tenant-logout", adminId: "admin-logout" });
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/admins/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await readJson(res);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(400);
      expect(body.detail).toBe("Missing refresh token");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("handles unexpected errors via global error handler", async () => {
    process.env.ADMIN_JWKS_PRIVATE_JSON = "not-json";
    process.env.ADMIN_JWT_ACTIVE_KID = "kid-bad";
    process.env.ADMIN_JWT_ISS = "lokaltreu-admin";
    process.env.ADMIN_JWT_AUD = "lokaltreu-api";
    resetAdminJwtCache();
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
      const body = await readJson(res);
      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(getNumber(body, "status")).toBe(500);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
