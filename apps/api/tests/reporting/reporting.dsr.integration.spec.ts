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

function getNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number for ${key}`);
  }
  return value;
}

describe("reporting DSR integration", () => {
  beforeAll(async () => {
    envSnapshot = { ...process.env };
    await setJwksEnv("reporting-dsr-kid");
    resetAdminJwtCache();
  });

  afterAll(() => {
    process.env = { ...envSnapshot };
    resetAdminJwtCache();
  });

  it("excludes tombstoned subjects from aggregates", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const tenantId = "tenant-dsr-reporting";
      const token = await issueAccessToken({ tenantId, adminId: "admin-1" });

      const tokenResA = await fetch(`${baseUrl}/stamps/tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "dsr-reporting-1",
        },
      });
      expect(tokenResA.status).toBe(201);
      const tokenBodyA = await readJson(tokenResA);
      const qrTokenA = tokenBodyA.qrToken;
      if (typeof qrTokenA !== "string") {
        throw new Error("Expected qrToken");
      }

      const tokenResB = await fetch(`${baseUrl}/stamps/tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "dsr-reporting-2",
        },
      });
      expect(tokenResB.status).toBe(201);
      const tokenBodyB = await readJson(tokenResB);
      const qrTokenB = tokenBodyB.qrToken;
      if (typeof qrTokenB !== "string") {
        throw new Error("Expected qrToken");
      }

      const claimA = await fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "dsr-reporting-3",
          "X-Card-Id": "card-dsr-a",
        },
        body: JSON.stringify({ qrToken: qrTokenA }),
      });
      expect(claimA.status).toBe(200);

      const claimB = await fetch(`${baseUrl}/stamps/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "dsr-reporting-4",
          "X-Card-Id": "card-dsr-b",
        },
        body: JSON.stringify({ qrToken: qrTokenB }),
      });
      expect(claimB.status).toBe(200);

      const summaryBefore = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(summaryBefore.status).toBe(200);
      const summaryBeforeBody = await readJson(summaryBefore);
      const stampsBefore = summaryBeforeBody.stamps;
      if (!isRecord(stampsBefore)) {
        throw new Error("Expected stamps object");
      }
      expect(getNumber(stampsBefore, "month")).toBe(2);

      const createDsr = await fetch(`${baseUrl}/dsr/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "dsr-reporting-5",
          "X-Tenant-Id": tenantId,
        },
        body: JSON.stringify({
          requestType: "DELETE",
          subject: { subject_type: "card_id", subject_id: "card-dsr-a" },
        }),
      });
      expect(createDsr.status).toBe(201);
      const createBody = await readJson(createDsr);
      const dsrId = createBody.dsrRequestId;
      if (typeof dsrId !== "string") {
        throw new Error("Expected dsrRequestId");
      }

      const fulfillDsr = await fetch(`${baseUrl}/dsr/requests/${dsrId}/fulfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "dsr-reporting-6",
          "X-Tenant-Id": tenantId,
        },
        body: JSON.stringify({ action: "DELETE" }),
      });
      expect(fulfillDsr.status).toBe(200);

      const summaryAfter = await fetch(`${baseUrl}/admins/reporting/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(summaryAfter.status).toBe(200);
      const summaryAfterBody = await readJson(summaryAfter);
      const stampsAfter = summaryAfterBody.stamps;
      if (!isRecord(stampsAfter)) {
        throw new Error("Expected stamps object");
      }
      expect(getNumber(stampsAfter, "month")).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
