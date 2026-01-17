import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import type { KeyLike } from "jose";
import { issueAccessToken, resetAdminJwtCache } from "../../src/auth/admin-jwt.js";
import { createAppServer } from "../../src/index.js";

const ISSUER = "lokaltreu-admin";
const AUDIENCE = "lokaltreu-api";
let envSnapshot: NodeJS.ProcessEnv;

async function setJwksEnv(kid: string): Promise<{ kid: string; privateKey: KeyLike }> {
  const { privateKey } = await generateKeyPair("EdDSA");
  const privateJwk = await exportJWK(privateKey);
  privateJwk.kid = kid;
  privateJwk.alg = "EdDSA";
  process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [privateJwk] });
  process.env.ADMIN_JWT_ACTIVE_KID = kid;
  process.env.ADMIN_JWT_ISS = ISSUER;
  process.env.ADMIN_JWT_AUD = AUDIENCE;
  return { kid, privateKey };
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

function getRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = obj[key];
  if (!isRecord(value)) {
    throw new Error(`Expected object for ${key}`);
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

describe("reporting summary http", () => {
  beforeAll(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("reporting-summary-kid");
    resetAdminJwtCache();
  });

  afterAll(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("returns zeroed aggregates for a tenant without events", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-empty", adminId: "admin-1" });

      const summaryRes = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(summaryRes.status).toBe(200);
      const summary = await readJson(summaryRes);
      const stamps = getRecord(summary, "stamps");
      expect(getNumber(stamps, "day")).toBe(0);
      expect(getNumber(stamps, "week")).toBe(0);
      expect(getNumber(stamps, "month")).toBe(0);
      getRecord(summary, "rewards");
      getRecord(summary, "referrals");
      getRecord(summary, "deviceActivity");
      getRecord(summary, "planUsage");
      getNumber(summary, "activeCampaigns");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("isolates tenants in summary aggregates", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const tokenA = await issueAccessToken({ tenantId: "tenant-a", adminId: "admin-a" });
      const tokenB = await issueAccessToken({ tenantId: "tenant-b", adminId: "admin-b" });

      const tokenRes = await fetch(`${baseUrl}/stamps/tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "Idempotency-Key": "summary-tenant-a-1",
        },
      });
      expect(tokenRes.status).toBe(201);
      const tokenBody = await readJson(tokenRes);
      const qrToken = tokenBody.qrToken;
      if (typeof qrToken !== "string") {
        throw new Error("Expected qrToken");
      }

      const claimRes = await fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "summary-tenant-a-2",
          "X-Card-Id": "card-tenant-a",
        },
        body: JSON.stringify({ qrToken }),
      });
      expect(claimRes.status).toBe(200);

      const summaryRes = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(summaryRes.status).toBe(200);
      const summary = await readJson(summaryRes);
      const stamps = getRecord(summary, "stamps");
      expect(getNumber(stamps, "day")).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
