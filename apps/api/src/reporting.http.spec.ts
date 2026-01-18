import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import type { KeyLike } from "jose";
import { issueAccessToken, resetAdminJwtCache } from "./auth/admin-jwt.js";
import { createAppServer } from "./index.js";

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
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number for ${key}`);
  }
  return value;
}

function getRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = obj[key];
  if (!isRecord(value)) {
    throw new Error(`Expected object for ${key}`);
  }
  return value;
}

function getString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string for ${key}`);
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

describe("reporting APIs", () => {
  beforeEach(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("reporting-kid");
    resetAdminJwtCache();
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("returns summary and timeseries for stamps", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-reporting", adminId: "admin-1" });

      const tokenRes = await fetch(`${baseUrl}/stamps/tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "idem-report-1",
        },
      });
      expect(tokenRes.status).toBe(201);
      const tokenBody = await readJson(tokenRes);
      const qrToken = tokenBody["qrToken"];
      if (typeof qrToken !== "string") {
        throw new Error("Expected qrToken");
      }

      const claimRes = await fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-report-2",
        },
        body: JSON.stringify({ qrToken }),
      });
      expect(claimRes.status).toBe(200);

      const summaryRes = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(summaryRes.status).toBe(200);
      const summary = await readJson(summaryRes);
      getRecord(summary, "stamps");
      getRecord(summary, "rewards");
      getRecord(summary, "referrals");
      getRecord(summary, "deviceActivity");
      getRecord(summary, "planUsage");
      getNumber(summary, "activeCampaigns");
      const stamps = getRecord(summary, "stamps");
      expect(getNumber(stamps, "day")).toBeGreaterThanOrEqual(1);
      expect(getNumber(stamps, "week")).toBeGreaterThanOrEqual(1);
      expect(getNumber(stamps, "month")).toBeGreaterThanOrEqual(1);

      const timeseriesRes = await fetch(
        `${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      expect(timeseriesRes.status).toBe(200);
      const timeseries = await readJson(timeseriesRes);
      expect(getString(timeseries, "metric")).toBe("stamps");
      expect(getString(timeseries, "bucket")).toBe("day");
      getString(timeseries, "from");
      getString(timeseries, "to");
      const series = timeseries["series"];
      if (!Array.isArray(series)) {
        throw new Error("Expected series array");
      }
      const counts = series
        .map((item) => (isRecord(item) ? item["count"] : null))
        .filter((value): value is number => typeof value === "number");
      expect(counts.reduce((acc, value) => acc + value, 0)).toBeGreaterThanOrEqual(1);
    } finally {
      server.close();
    }
  });

  it("returns problem+json when missing auth", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const summaryRes = await fetch(`${baseUrl}/admins/reporting/summary`);
      expect([401, 403]).toContain(summaryRes.status);
      const contentType = summaryRes.headers.get("content-type") ?? "";
      expect(contentType).toContain("application/problem+json");
      const problem = await readJson(summaryRes);
      expect(getString(problem, "type")).toMatch(/^https?:\/\//);
      getString(problem, "title");
      getNumber(problem, "status");
    } finally {
      server.close();
    }
  });
});
