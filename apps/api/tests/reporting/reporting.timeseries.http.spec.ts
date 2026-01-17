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

describe("reporting timeseries http", () => {
  beforeAll(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("reporting-timeseries-kid");
    resetAdminJwtCache();
  });

  afterAll(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("rejects invalid metric or bucket", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-timeseries", adminId: "admin-1" });

      const badMetric = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=unknown&bucket=day`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(badMetric.status).toBe(400);
      expect(badMetric.headers.get("content-type")).toContain("application/problem+json");

      const badBucket = await fetch(`${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=year`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(badBucket.status).toBe(400);
      expect(badBucket.headers.get("content-type")).toContain("application/problem+json");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects invalid date parameters", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-timeseries", adminId: "admin-1" });

      const badFrom = await fetch(
        `${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day&from=not-a-date`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(badFrom.status).toBe(400);
      expect(badFrom.headers.get("content-type")).toContain("application/problem+json");

      const badRange = await fetch(
        `${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day&from=2025-01-02T00:00:00.000Z&to=2025-01-01T00:00:00.000Z`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(badRange.status).toBe(400);
      expect(badRange.headers.get("content-type")).toContain("application/problem+json");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns empty timeseries for a range with no events", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const token = await issueAccessToken({ tenantId: "tenant-timeseries", adminId: "admin-1" });
      const res = await fetch(
        `${baseUrl}/admins/reporting/timeseries?metric=stamps&bucket=day&from=2025-01-01T00:00:00.000Z&to=2025-01-02T00:00:00.000Z`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status).toBe(200);
      const body = await readJson(res);
      const series = body.series;
      if (!Array.isArray(series)) {
        throw new Error("Expected series array");
      }
      const total = series
        .map((item) => (isRecord(item) ? item.count : null))
        .filter((value): value is number => typeof value === "number")
        .reduce((acc, value) => acc + value, 0);
      expect(total).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
