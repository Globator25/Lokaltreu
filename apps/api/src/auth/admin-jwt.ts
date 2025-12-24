import { randomUUID } from "node:crypto";
import { SignJWT, createLocalJWKSet, importJWK, jwtVerify, errors as JoseErrors } from "jose";
import type { JWK, JSONWebKeySet, JWTPayload, KeyLike } from "jose";

type IssueAccessTokenInput = {
  tenantId: string;
  adminId: string;
};

type VerifiedAccessToken = {
  tenantId: string;
  adminId: string;
  jti: string;
  expiresAt: number;
};

type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: ProblemErrorCode;
  correlation_id?: string;
};

type ProblemErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_REUSE"
  | "SELF_REFERRAL_BLOCKED"
  | "REFERRAL_LIMIT_REACHED"
  | "REFERRAL_TENANT_MISMATCH"
  | "PLAN_NOT_ALLOWED"
  | "RATE_LIMITED";

const ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_ISSUER = "lokaltreu-admin";
const DEFAULT_AUDIENCE = "lokaltreu-api";

export class ProblemError extends Error {
  readonly details: ProblemDetails;

  constructor(details: ProblemDetails) {
    super(details.title);
    this.details = details;
  }

  toProblem(): ProblemDetails {
    return this.details;
  }
}

type Jwks = JSONWebKeySet;
type SigningKey = { kid: string; alg: string; key: KeyLike | Uint8Array };

let cachedJwks: Jwks | null = null;
let cachedPublicJwks: Jwks | null = null;
let cachedSigningKey: SigningKey | null = null;

export function resetAdminJwtCache() {
  cachedJwks = null;
  cachedPublicJwks = null;
  cachedSigningKey = null;
}

function getIssuer(): string {
  return process.env.ADMIN_JWT_ISS ?? DEFAULT_ISSUER;
}

function getAudience(): string {
  return process.env.ADMIN_JWT_AUD ?? DEFAULT_AUDIENCE;
}

export function getAdminJwtDefaults() {
  return {
    issuer: getIssuer(),
    audience: getAudience(),
  };
}

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
  if (cachedJwks) {
    return cachedJwks;
  }
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
  cachedJwks = jwks;
  return jwks;
}

function toPublicJwk(jwk: JWK): JWK {
  const privateFields = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
  const entries = Object.entries(jwk).filter(([key]) => !privateFields.has(key));
  return Object.fromEntries(entries) as JWK;
}

export function getAdminPublicJwks(): Jwks {
  if (cachedPublicJwks) {
    return cachedPublicJwks;
  }
  const jwks = parseJwksFromEnv();
  const publicKeys = jwks.keys.map(toPublicJwk).filter(isJwk);
  if (publicKeys.length === 0) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/jwks-empty",
      title: "JWKS has no public keys",
      status: 500,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  cachedPublicJwks = { keys: publicKeys };
  return cachedPublicJwks;
}

export function getPublicJwks(): Jwks {
  return getAdminPublicJwks();
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

async function getSigningKey(): Promise<SigningKey> {
  if (cachedSigningKey) {
    return cachedSigningKey;
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
  const jwk = jwks.keys.find((key) => key.kid === kid && typeof key.kty === "string");
  if (!jwk) {
    throw new ProblemError({
      type: "https://errors.lokaltreu.example/auth/kid-not-found",
      title: "Active KID not found",
      status: 401,
      error_code: "TOKEN_REUSE",
      correlation_id: randomUUID(),
    });
  }
  const alg = inferAlg(jwk);
  const key = await importJWK(jwk, alg);
  cachedSigningKey = { kid, alg, key };
  return cachedSigningKey;
}

export async function issueAccessToken(input: IssueAccessTokenInput): Promise<string> {
  const { tenantId, adminId } = input;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TTL_SECONDS;
  const { kid, alg, key } = await getSigningKey();

  return new SignJWT({ tenant_id: tenantId })
    .setProtectedHeader({ alg, kid, typ: "JWT" })
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(randomUUID())
    .setSubject(adminId)
    .sign(key);
}

type VerifyAccessTokenResult =
  | { ok: true; payload: VerifiedAccessToken }
  | { ok: false; problem: ProblemDetails };

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

function extractVerifiedPayload(payload: JWTPayload): VerifiedAccessToken | null {
  const tenantId = payload["tenant_id"];
  const adminId = payload.sub;
  const jti = payload.jti;
  const exp = payload.exp;
  if (typeof tenantId !== "string" || typeof adminId !== "string") {
    return null;
  }
  if (typeof jti !== "string" || typeof exp !== "number") {
    return null;
  }
  return { tenantId, adminId, jti, expiresAt: exp };
}

export async function verifyAccessToken(token: string): Promise<VerifyAccessTokenResult> {
  try {
    const jwks = createLocalJWKSet(getAdminPublicJwks());
    const { payload } = await jwtVerify(token, jwks, {
      issuer: getIssuer(),
      audience: getAudience(),
    });

    const verified = extractVerifiedPayload(payload);
    if (!verified) {
      return {
        ok: false,
        problem: {
          type: "https://errors.lokaltreu.example/auth/invalid-claims",
          title: "Invalid token claims",
          status: 401,
          error_code: "TOKEN_REUSE",
          correlation_id: randomUUID(),
        },
      };
    }

    return { ok: true, payload: verified };
  } catch (err: unknown) {
    if (err instanceof ProblemError) {
      return { ok: false, problem: err.toProblem() };
    }
    return { ok: false, problem: mapJoseError(err) };
  }
}
