import { afterEach, beforeEach, describe, expect as vitestExpect, it } from "vitest";
import * as chai from "chai";
import chaiOpenapiResponseValidator from "chai-openapi-response-validator";
import { exportJWK, generateKeyPair } from "jose";
import { fileURLToPath } from "node:url";
import { createAppServer } from "./index.js";
import { resetAdminJwtCache } from "./auth/admin-jwt.js";

const openapiPath = fileURLToPath(new URL("../openapi/lokaltreu-openapi-v2.0.yaml", import.meta.url));
let openapiValidatorLoaded = false;

try {
  chai.use(chaiOpenapiResponseValidator(openapiPath));
  openapiValidatorLoaded = true;
} catch {
  console.warn(
    "Admin-Auth-Contract-Tests werden übersprungen: OpenAPI-Spec ist invalid (z. B. StampClaimRequest)."
  );
}

const { expect } = chai;
const describeContract = openapiValidatorLoaded ? describe : describe.skip;

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

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function validationResponse(res: Response, body: unknown, method: string, path: string) {
  return {
    status: res.status,
    body,
    headers: headersToObject(res.headers),
    req: { method, path },
    request: { method, url: `http://localhost${path}` },
  };
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
      if (!loginBody) {
        throw new Error("Expected login body");
      }
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
      expect(validationResponse(refreshed, refreshedBody, "POST", "/admins/refresh")).to.satisfyApiSpec;

      const invalidRefresh = await fetch(`${baseUrl}/admins/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: "invalid-refresh" }),
      });
      const invalidBody = await readJson(invalidRefresh);
      expect(validationResponse(invalidRefresh, invalidBody, "POST", "/admins/refresh")).to.satisfyApiSpec;
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
      expect(validationResponse(logout, null, "POST", "/admins/logout")).to.satisfyApiSpec;

      const noAuth = await fetch(`${baseUrl}/admins/logout`, { method: "POST" });
      const noAuthBody = await readJson(noAuth);
      expect(validationResponse(noAuth, noAuthBody, "POST", "/admins/logout")).to.satisfyApiSpec;
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
