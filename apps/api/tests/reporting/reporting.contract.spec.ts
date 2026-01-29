import { afterAll, beforeAll, describe, expect as vitestExpect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { createAppServer } from "../../src/index.js";
import { issueAccessToken, resetAdminJwtCache } from "../../src/auth/admin-jwt.js";
import { resetAdminKeystoreCache } from "../../src/modules/auth/keystore.js";

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
    correlation_id: vitestExpect.any(String),
  });
  if (body && "error_code" in body) {
    vitestExpect(body.error_code).toEqual(vitestExpect.any(String));
  }
}

describeContract("reporting contract", () => {
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
      expectJsonContentType(ok, "application/json");
      vitestExpect(okBody).toMatchObject({
        stamps: vitestExpect.any(Object),
        rewards: vitestExpect.any(Object),
        referrals: vitestExpect.any(Object),
        deviceActivity: vitestExpect.any(Object),
        planUsage: vitestExpect.any(Object),
        activeCampaigns: vitestExpect.any(Number),
      });

      const unauthorized = await fetch(`${baseUrl}/admins/reporting/summary`);
      const unauthorizedBody = await readJson(unauthorized);
      vitestExpect(unauthorized.status).toBe(401);
      expectJsonContentType(unauthorized, "application/problem+json");
      expectProblemJson(unauthorizedBody);
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
      expectJsonContentType(ok, "application/json");
      vitestExpect(okBody).toMatchObject({
        metric: vitestExpect.any(String),
        bucket: vitestExpect.any(String),
        series: vitestExpect.any(Array),
      });

      const bad = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=invalid&bucket=day`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const badBody = await readJson(bad);
      vitestExpect(bad.status).toBe(400);
      expectJsonContentType(bad, "application/problem+json");
      expectProblemJson(badBody);

      const unauthorized = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day`);
      const unauthorizedBody = await readJson(unauthorized);
      vitestExpect(unauthorized.status).toBe(401);
      expectJsonContentType(unauthorized, "application/problem+json");
      expectProblemJson(unauthorizedBody);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
