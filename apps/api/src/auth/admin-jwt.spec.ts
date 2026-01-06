import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";
import {
  issueAdminAccessToken,
  issueAdminRefreshToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken,
} from "./admin-jwt.js";

let envSnapshot: NodeJS.ProcessEnv;

async function setAdminKeyEnv() {
  const { privateKey } = await generateKeyPair("EdDSA");
  const privatePem = await exportPKCS8(privateKey);
  process.env.ADMIN_JWT_KID = "kid-admin";
  process.env.ADMIN_JWT_PRIVATE_KEY = privatePem;
  process.env.ADMIN_JWT_ALG = "EdDSA";
}

describe("admin-jwt", () => {
  beforeEach(async () => {
    envSnapshot = { ...process.env };
    await setAdminKeyEnv();
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("issues and verifies an access token", async () => {
    const token = await issueAdminAccessToken({ sub: "admin-1", tenantId: "tenant-1", sessionJti: "sess-1" });
    const result = await verifyAdminAccessToken(token);
    expect(result.payload.sub).toBe("admin-1");
    expect(result.payload.tenantId).toBe("tenant-1");
    expect(result.payload.sessionJti).toBe("sess-1");
    expect(result.payload.type).toBe("access");
    expect(result.protectedHeader.typ).toBe("JWT");
  });

  it("issues and verifies a refresh token", async () => {
    const token = await issueAdminRefreshToken({ sub: "admin-2", tenantId: "tenant-2" });
    const result = await verifyAdminRefreshToken(token);
    expect(result.payload.sub).toBe("admin-2");
    expect(result.payload.tenantId).toBe("tenant-2");
    expect(result.payload.type).toBe("refresh");
    expect(result.protectedHeader.typ).toBe("JWT");
  });

  it("rejects refresh tokens when verifying access tokens", async () => {
    const token = await issueAdminRefreshToken({ sub: "admin-3", tenantId: "tenant-3" });
    await expect(verifyAdminAccessToken(token)).rejects.toThrow("Invalid token type");
  });

  it("rejects access tokens when verifying refresh tokens", async () => {
    const token = await issueAdminAccessToken({ sub: "admin-4", tenantId: "tenant-4" });
    await expect(verifyAdminRefreshToken(token)).rejects.toThrow("Invalid token type");
  });
});
