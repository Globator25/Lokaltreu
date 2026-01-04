import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, importJWK } from "jose";
import type { JWK } from "jose";

let envSnapshot: NodeJS.ProcessEnv;

async function setJwksEnv(keys: JWK[], activeKid: string) {
  process.env.ADMIN_JWKS_PRIVATE_JSON = JSON.stringify({ keys });
  process.env.ADMIN_JWT_ACTIVE_KID = activeKid;
}

describe("keystore", () => {
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.resetModules();
  });

  it("returns public JWKS without private fields", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const privateJwk = await exportJWK(privateKey);
    privateJwk.kid = "kid-public";
    privateJwk.alg = "EdDSA";
    await setJwksEnv([privateJwk], "kid-public");

    const { getPublicJwks } = await import("./keystore.js");
    const jwks = await getPublicJwks();
    expect(Array.isArray(jwks.keys)).toBe(true);
    expect(jwks.keys).toHaveLength(1);
    const key = jwks.keys[0] as JWK & Record<string, unknown>;
    expect(key.d).toBeUndefined();
    expect(key.p).toBeUndefined();
    expect(key.q).toBeUndefined();
    expect(key.dp).toBeUndefined();
    expect(key.dq).toBeUndefined();
    expect(key.qi).toBeUndefined();
  });

  it("invalidates tokens after removing old keys", async () => {
    const { privateKey: key1 } = await generateKeyPair("EdDSA");
    const { privateKey: key2 } = await generateKeyPair("EdDSA");
    const jwk1 = await exportJWK(key1);
    jwk1.kid = "kid-1";
    jwk1.alg = "EdDSA";
    const jwk2 = await exportJWK(key2);
    jwk2.kid = "kid-2";
    jwk2.alg = "EdDSA";
    await setJwksEnv([jwk1, jwk2], "kid-2");

    const signingKey = (await importJWK(jwk1, "EdDSA")) as unknown;
    const token = await new SignJWT({ sub: "admin-1" })
      .setProtectedHeader({ alg: "EdDSA", kid: "kid-1", typ: "JWT" })
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(signingKey as Parameters<SignJWT["sign"]>[0]);

    const { verifyAdminJwt } = await import("./keystore.js");
    await expect(verifyAdminJwt(token)).resolves.toBeTruthy();

    await setJwksEnv([jwk2], "kid-2");
    vi.resetModules();
    const { verifyAdminJwt: verifyAfterRotation } = await import("./keystore.js");
    await expect(verifyAfterRotation(token)).rejects.toMatchObject({
      details: { status: 401 },
    });
  });
});
