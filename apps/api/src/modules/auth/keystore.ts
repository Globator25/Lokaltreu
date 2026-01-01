import { createLocalJWKSet, importJWK, jwtVerify, errors as JoseErrors } from "jose";
import type { JWK, JSONWebKeySet, KeyLike, JWTVerifyResult } from "jose";
import { randomUUID } from "node:crypto";

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code: string;
  correlation_id: string;
};

export class ProblemError extends Error {
  readonly details: ProblemDetails;

  constructor(details: ProblemDetails) {
    super(details.title);
    this.details = details;
  }
}

type Jwks = JSONWebKeySet;
type AdminSigningContext = {
  jwks: { keys: JWK[] };
  activeJwk: JWK;
  signingKey: KeyLike;
  kid: string;
  alg: string;
};

const PRIVATE_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);

let adminSigningContext: AdminSigningContext | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJwk(value: unknown): value is JWK {
  return isRecord(value) && typeof value.kty === "string" && value.kty.length > 0;
}

function isJwks(value: unknown): value is Jwks {
  return isRecord(value) && Array.isArray(value.keys) && value.keys.every(isJwk);
}

function parseJwksFromEnv(): Jwks {
  const raw = process.env.ADMIN_JWKS_PRIVATE_JSON;
  if (!raw) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/jwks-missing",
      title: "JWKS not configured",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/jwks-invalid",
      title: "JWKS parse error",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  const jwks = isJwks(parsed) ? parsed : isJwk(parsed) ? { keys: [parsed] } : null;
  if (!jwks || jwks.keys.length === 0) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/jwks-empty",
      title: "JWKS has no keys",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  return jwks;
}

function toPublicJwk(jwk: JWK): JWK {
  const entries = Object.entries(jwk).filter(([key]) => !PRIVATE_FIELDS.has(key));
  return Object.fromEntries(entries) as JWK;
}

function inferAlg(jwk: JWK): string {
  if (typeof jwk.alg === "string" && jwk.alg.length > 0) {
    return jwk.alg;
  }
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    return "EdDSA";
  }
  if (jwk.kty === "EC" && jwk.crv === "P-256") {
    return "ES256";
  }
  if (jwk.kty === "EC" && jwk.crv === "P-384") {
    return "ES384";
  }
  if (jwk.kty === "EC" && jwk.crv === "P-521") {
    return "ES512";
  }
  return "RS256";
}

async function loadAdminSigningContext(): Promise<AdminSigningContext> {
  if (adminSigningContext) {
    return adminSigningContext;
  }
  const jwks = parseJwksFromEnv();
  const kid = process.env.ADMIN_JWT_ACTIVE_KID;
  if (!kid) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/kid-missing",
      title: "Active KID not configured",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  const keys = jwks.keys;
  const activeJwk = keys.find((key) => key.kid === kid && typeof key.kty === "string");
  if (!activeJwk) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/kid-not-found",
      title: "Active KID not found",
      status: 401,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  const alg = inferAlg(activeJwk);
  const importedKey = await importJWK(activeJwk, alg);
  if (activeJwk.kty === "oct" || importedKey instanceof Uint8Array) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/key-unsupported",
      title: "Unsupported signing key type",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  const signingKey: KeyLike = importedKey;
  const context: AdminSigningContext = {
    jwks: { keys: jwks.keys },
    activeJwk,
    signingKey,
    kid,
    alg,
  };
  adminSigningContext = context;
  return context;
}

export async function getActiveSigningKey(): Promise<{ kid: string; alg: string; key: KeyLike }> {
  const ctx = await loadAdminSigningContext();
  return { kid: ctx.kid, alg: ctx.alg, key: ctx.signingKey };
}

export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const ctx = await loadAdminSigningContext();
  return { keys: ctx.jwks.keys.map(toPublicJwk) };
}

function mapJoseError(err: unknown): ProblemDetails {
  if (err instanceof JoseErrors.JWTExpired) {
    return {
      type: "https://errors.lokaltreu.example/auth/token-expired",
      title: "Token expired",
      status: 401,
      error_code: "TOKEN_EXPIRED",
      correlation_id: randomUUID(),
    };
  }
  if (
    err instanceof JoseErrors.JWTInvalid ||
    err instanceof JoseErrors.JWSSignatureVerificationFailed ||
    err instanceof JoseErrors.JWSInvalid ||
    err instanceof JoseErrors.JWKSNoMatchingKey
  ) {
    return {
      type: "https://errors.lokaltreu.example/auth/token-invalid",
      title: "Token invalid",
      status: 401,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    };
  }
  return {
    type: "https://errors.lokaltreu.example/auth/verification-failed",
    title: "Token verification failed",
    status: 401,
    error_code: "TOKEN_REUSE",
    correlation_id: randomUUID(),
  };
}

export async function verifyAdminJwt(token: string): Promise<JWTVerifyResult> {
  try {
    const ctx = await loadAdminSigningContext();
    const jwks = createLocalJWKSet({ keys: ctx.jwks.keys.map(toPublicJwk) });
    return await jwtVerify(token, jwks, {
      algorithms: [ctx.alg],
    });
  } catch (err: unknown) {
    if (err instanceof ProblemError) {
      throw err;
    }
    throw new ProblemError(mapJoseError(err));
  }
}
