import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";

let envSnapshot: NodeJS.ProcessEnv;

function loadModule() {
  vi.resetModules();
  return import("./admin-keys.js");
}

describe("admin-keys", () => {
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("throws when signing key env is missing", async () => {
    delete process.env.ADMIN_JWT_KID;
    delete process.env.ADMIN_JWT_PRIVATE_KEY;
    const mod = await loadModule();
    await expect(mod.getActiveSigningKey()).rejects.toThrow(
      "Admin JWT key not configured (ADMIN_JWT_KID / ADMIN_JWT_PRIVATE_KEY missing)"
    );
  });

  it("returns cached active key and builds JWKS", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const privatePem = await exportPKCS8(privateKey);
    process.env.ADMIN_JWT_KID = "kid-admin-1";
    process.env.ADMIN_JWT_PRIVATE_KEY = privatePem;
    process.env.ADMIN_JWT_ALG = "RS256";

    const mod = await loadModule();
    const first = await mod.getActiveSigningKey();
    const second = await mod.getActiveSigningKey();
    expect(first).toBe(second);
    expect(first.kid).toBe("kid-admin-1");
    expect(first.alg).toBe("RS256");

    const jwks = await mod.getAdminJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kid).toBe("kid-admin-1");
    expect(jwks.keys[0].alg).toBe("RS256");
    expect(jwks.keys[0].use).toBe("sig");
  });
});
