import { afterAll, beforeAll, describe, expect as vitestExpect, it } from "vitest";
import * as chai from "chai";
import chaiOpenapiResponseValidator from "chai-openapi-response-validator";
import { exportJWK, generateKeyPair } from "jose";
import { fileURLToPath } from "node:url";
import { createAppServer } from "../../src/index.js";
import { issueAccessToken, resetAdminJwtCache } from "../../src/auth/admin-jwt.js";
import { resetAdminKeystoreCache } from "../../src/modules/auth/keystore.js";

const openapiPath = fileURLToPath(new URL("../../openapi/lokaltreu-openapi-v2.0.yaml", import.meta.url));
let openapiValidatorLoaded = false;
let openapiValidatorError: unknown = null;

try {
  chai.use(chaiOpenapiResponseValidator(openapiPath));
  openapiValidatorLoaded = true;
} catch (error) {
  openapiValidatorError = error;
}

const { expect } = chai;
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
  resetAdminKeystoreCache();
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

describeContract("reporting contract", () => {
  if (!openapiValidatorLoaded) {
    throw new Error(
      `OpenAPI ist invalid – bitte Spec reparieren (schema_drift = 0). Details: ${
        openapiValidatorError instanceof Error ? openapiValidatorError.message : "unknown error"
      }`
    );
  }

  beforeAll(() => {
    envSnapshot = { ...process.env };
  });

  afterAll(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("validates reporting summary 200 and 401", async () => {
    await setValidJwksEnv("kid-contract-summary");
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-contract", adminId: "admin-1" });
      const ok = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const okBody = await readJson(ok);
      vitestExpect(ok.status).toBe(200);
      expect(validationResponse(ok, okBody, "GET", "/admins/reporting/summary")).to.satisfyApiSpec;

      const unauthorized = await fetch(`${baseUrl}/admins/reporting/summary`);
      const unauthorizedBody = await readJson(unauthorized);
      expect(validationResponse(unauthorized, unauthorizedBody, "GET", "/admins/reporting/summary")).to.satisfyApiSpec;
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("validates reporting timeseries 200, 400, and 401", async () => {
    await setValidJwksEnv("kid-contract-timeseries");
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-contract", adminId: "admin-1" });
      const ok = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const okBody = await readJson(ok);
      vitestExpect(ok.status).toBe(200);
      expect(validationResponse(ok, okBody, "GET", "/admins/reporting/timeseries")).to.satisfyApiSpec;

      const bad = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=invalid&bucket=day`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const badBody = await readJson(bad);
      expect(validationResponse(bad, badBody, "GET", "/admins/reporting/timeseries")).to.satisfyApiSpec;

      const unauthorized = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day`);
      const unauthorizedBody = await readJson(unauthorized);
      expect(validationResponse(unauthorized, unauthorizedBody, "GET", "/admins/reporting/timeseries")).to.satisfyApiSpec;
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
