// apps/api/src/auth/admin-keys.ts
// Verantwortlich für Admin-JWT-Schlüssel + JWKS

import { exportJWK, importPKCS8 } from 'jose';
import type { JWK, KeyLike } from 'jose';

type AdminSigningKey = {
  kid: string;
  alg: string;
  privateKey: KeyLike;
  publicJwk: JWK;
};

let activeKey: AdminSigningKey | null = null;

/**
 * Lädt den aktiven Admin-Signierschlüssel aus ENV/Secret-Store.
 * KEINE Hardcoded-Keys im Code.
 */
export async function getActiveSigningKey(): Promise<AdminSigningKey> {
  if (activeKey) return activeKey;

  const kid = process.env.ADMIN_JWT_KID;
  const privatePem = process.env.ADMIN_JWT_PRIVATE_KEY;
  const alg = process.env.ADMIN_JWT_ALG ?? 'RS256';

  if (!kid || !privatePem) {
    throw new Error('Admin JWT key not configured (ADMIN_JWT_KID / ADMIN_JWT_PRIVATE_KEY missing)');
  }

  const privateKey = await importPKCS8(privatePem, alg);
  const publicJwk = await exportJWK(privateKey);

  activeKey = {
    kid,
    alg,
    privateKey,
    publicJwk,
  };
  return activeKey;
}

/**
 * Liefert JWKS für alle aktiven Admin-Signierschlüssel.
 * Für den Anfang: nur der eine aktive Key.
 */
export async function getAdminJwks() {
  const key = await getActiveSigningKey();
  return {
    keys: [
      {
        ...key.publicJwk,
        kid: key.kid,
        alg: key.alg,
        use: 'sig',
      },
    ],
  };
}
