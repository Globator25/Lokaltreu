import { afterEach, beforeEach, describe, expect as vitestExpect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { createAppServer } from "./index.js";
import { resetAdminJwtCache } from "./auth/admin-jwt.js";

const describeContract = describe;

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

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("application/problem+json")) {
    return null;
  }
  const data: unknown = await res.json();
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function expectJsonContentType(res: Response, expected: "application/json" | "application/problem+json") {
  vitestExpect(res.headers.get("content-type") ?? "").toContain(expected);
}

function expectProblemJson(body: Record<string, unknown> | null) {
  vitestExpect(body).toBeTruthy();
  vitestExpect(body).toMatchObject({
    type: vitestExpect.any(String),
    title: vitestExpect.any(String),
    status: vitestExpect.any(Number),
    detail: vitestExpect.any(String),
    instance: vitestExpect.any(String),
    error_code: vitestExpect.any(String),
    correlation_id: vitestExpect.any(String),
  });
}

describeContract("admin auth contract", () => {
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("validates /admins/refresh 200 and 401 responses", async () => {
    await setValidJwksEnv("kid-contract-refresh");
    const { server, baseUrl } = await startServer();
    try {
      const login = await fetch(`${baseUrl}/admins/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.invalid", password: "example-password-123" }),
      });
      const loginBody = await readJson(login);
      vitestExpect(login.status).toBe(200);
      expectJsonContentType(login, "application/json");
      if (!loginBody) {
        throw new Error("Expected login body");
      }
      vitestExpect(loginBody).toMatchObject({
        accessToken: vitestExpect.any(String),
        refreshToken: vitestExpect.any(String),
        expiresIn: vitestExpect.any(Number),
      });
      const accessToken = loginBody.accessToken as string;
      const refreshToken = loginBody.refreshToken as string;

      const refreshed = await fetch(`${baseUrl}/admins/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
      const refreshedBody = await readJson(refreshed);
      vitestExpect(refreshed.status).toBe(200);
      expectJsonContentType(refreshed, "application/json");
      vitestExpect(refreshedBody).toMatchObject({
        accessToken: vitestExpect.any(String),
        refreshToken: vitestExpect.any(String),
        expiresIn: vitestExpect.any(Number),
      });

      const invalidRefresh = await fetch(`${baseUrl}/admins/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: "invalid-refresh" }),
      });
      const invalidBody = await readJson(invalidRefresh);
      vitestExpect(invalidRefresh.status).toBe(401);
      expectJsonContentType(invalidRefresh, "application/problem+json");
      expectProblemJson(invalidBody);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("validates /admins/logout 204 and 401 responses", async () => {
    await setValidJwksEnv("kid-contract-logout");
    const { server, baseUrl } = await startServer();
    try {
      const login = await fetch(`${baseUrl}/admins/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.invalid", password: "example-password-123" }),
      });
      const loginBody = await readJson(login);
      vitestExpect(login.status).toBe(200);
      if (!loginBody) {
        throw new Error("Expected login body");
      }
      const accessToken = loginBody.accessToken as string;
      const refreshToken = loginBody.refreshToken as string;

      const logout = await fetch(`${baseUrl}/admins/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
      vitestExpect(logout.status).toBe(204);

      const noAuth = await fetch(`${baseUrl}/admins/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "missing-auth-token" }),
      });
      const noAuthBody = await readJson(noAuth);
      vitestExpect(noAuth.status).toBe(401);
      expectJsonContentType(noAuth, "application/problem+json");
      expectProblemJson(noAuthBody);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
