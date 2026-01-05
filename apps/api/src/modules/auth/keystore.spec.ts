import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

let envSnapshot: NodeJS.ProcessEnv;

async function loadModule() {
  vi.resetModules();
  return import("./keystore.js");
}

describe("keystore", () => {
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("returns problem when JWKS env is missing", async () => {
    delete process.env.ADMIN_JWKS_PRIVATE_JSON;
    delete process.env.ADMIN_JWT_ACTIVE_KID;
    const mod = await loadModule();
    await expect(mod.getPublicJwks()).rejects.toBeInstanceOf(mod.ProblemError);
  });

  it("returns problem when active kid is missing", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(privateKey);
    jwk.kid = "kid-missing";
    process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [jwk] });
    delete process.env.ADMIN_JWT_ACTIVE_KID;
    const mod = await loadModule();
    await expect(mod.getPublicJwks()).rejects.toBeInstanceOf(mod.ProblemError);
  });

  it("returns problem when active kid is not found", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(privateKey);
    jwk.kid = "kid-a";
    process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [jwk] });
    process.env.ADMIN_JWT_ACTIVE_KID = "kid-b";
    const mod = await loadModule();
    const err = await mod.getPublicJwks().catch((error: unknown) => error);
    expect(err).toBeInstanceOf(mod.ProblemError);
    if (err instanceof mod.ProblemError) {
      expect(err.details.status).toBe(401);
    }
  });

  it("returns problem for unsupported oct key", async () => {
    const jwk = {
      kty: "oct",
      kid: "kid-oct",
      alg: "HS256",
      k: Buffer.from("secret-key").toString("base64url"),
    };
    process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [jwk] });
    process.env.ADMIN_JWT_ACTIVE_KID = "kid-oct";
    const mod = await loadModule();
    await expect(mod.getActiveSigningKey()).rejects.toBeInstanceOf(mod.ProblemError);
  });

  it("verifies tokens and exposes public JWKS", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(privateKey);
    jwk.kid = "kid-ed";
    delete jwk.alg;
    process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [jwk] });
    process.env.ADMIN_JWT_ACTIVE_KID = "kid-ed";

    const mod = await loadModule();
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: "admin" })
      .setProtectedHeader({ alg: "EdDSA", kid: "kid-ed", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .setSubject("admin-1")
      .sign(privateKey);

    const result = await mod.verifyAdminJwt(token);
    expect(result.payload.sub).toBe("admin-1");

    const jwks = await mod.getPublicJwks();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kid).toBe("kid-ed");
    expect((jwks.keys[0] as { d?: string }).d).toBeUndefined();
  });

  it("maps invalid token to a 401 problem", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const jwk = await exportJWK(privateKey);
    jwk.kid = "kid-invalid";
    process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys: [jwk] });
    process.env.ADMIN_JWT_ACTIVE_KID = "kid-invalid";
    const mod = await loadModule();
    const err = await mod.verifyAdminJwt("not-a-jwt").catch((error: unknown) => error);
    expect(err).toBeInstanceOf(mod.ProblemError);
    if (err instanceof mod.ProblemError) {
      expect(err.details.status).toBe(401);
      expect(err.details.error_code).toBe("TOKEN_REUSE");
    }
  });
});
