import { verify } from "@noble/ed25519";
import type { Request, Response } from "express";
import { TextEncoder } from "node:util";
import { createDeviceProofProblem, type DeviceProofRejectionReason } from "@lokaltreu/types";
import { emitSecurityMetric } from "../observability.js";

type DeviceRegistryEntry = {
  key: string;
  expiresAt: number;
};

const DEVICE_KEY_TTL_MS = 15 * 60 * 1000;
const deviceRegistry = new Map<string, DeviceRegistryEntry>();

export type DeviceProofResult = {
  ok: boolean;
  reason?: DeviceProofRejectionReason;
  deviceId?: string;
};

/**
 * metricsDeviceProofFailed
 *
 * Keeps track of failed proofs for later Observability integration.
 */
function metricsDeviceProofFailed(reason: DeviceProofRejectionReason): void {
  emitSecurityMetric({
    name: "deviceProofFailed",
    attributes: {
      reason,
    },
  });
}

/**
 * getDevicePublicKey
 *
 * Placeholder device registry lookup. Replace with real registry + TTL + alerting.
 */
export async function getDevicePublicKey(deviceId: string): Promise<string | null> {
  // TODO: In Produktion kommt der Public Key aus der Geraete-Tabelle in Postgres (Neon EU).
  // Key wird beim Geraete-Onboarding hinterlegt.
  // Admin erhaelt dabei eine Sicherheits-E-Mail (Geraeteautorisierungspfad laut SPEC).
  // Diese In-Memory-Map ist nur ein Dev-Stub.
  const entry = deviceRegistry.get(deviceId);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    deviceRegistry.delete(deviceId);
    return null;
  }
  return entry.key;
}

/**
 * registerDevicePublicKey
 *
 * Helper for dev/testing to seed the in-memory registry.
 */
export function registerDevicePublicKey(deviceId: string, base64Key: string): void {
  deviceRegistry.set(deviceId, {
    key: base64Key,
    expiresAt: Date.now() + DEVICE_KEY_TTL_MS,
  });
}

const encoder = new TextEncoder();

/**
 * verifyDeviceProof
 *
 * Verifies the Ed25519 based device proof headers on the incoming request.
 */
export async function verifyDeviceProof(req: Request): Promise<DeviceProofResult> {
  const signatureHeader = req.get("x-device-proof") ?? ""; // Expect Base64 encoded Ed25519 signature (64 bytes).
  const deviceId = req.get("x-device-id") ?? "";
  const timestampHeader = req.get("x-device-timestamp") ?? ""; // Unix timestamp in milliseconds as string.
  const jtiHeader =
    req.get("x-device-jti") ?? (typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "missing-jti");

  const now = Date.now();
  if (!signatureHeader || !deviceId || !timestampHeader) {
    metricsDeviceProofFailed("MISSING_HEADERS");
    return { ok: false, reason: "MISSING_HEADERS" };
  }

  const timestampValue = Number(timestampHeader);
  if (!Number.isFinite(timestampValue)) {
    metricsDeviceProofFailed("MISSING_HEADERS");
    return { ok: false, reason: "MISSING_HEADERS", deviceId };
  }

  // SPEC v2.0: DeviceProof Zeitfenster +/-60 Sekunden. Alles ausserhalb blocken.
  if (Math.abs(now - timestampValue) > 60_000) {
    metricsDeviceProofFailed("TIMESTAMP_OUTSIDE_ALLOWED_WINDOW");
    return { ok: false, reason: "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW", deviceId };
  }

  const publicKeyBase64 = await getDevicePublicKey(deviceId);
  if (!publicKeyBase64) {
    metricsDeviceProofFailed("UNKNOWN_DEVICE");
    return { ok: false, reason: "UNKNOWN_DEVICE", deviceId };
  }

  const message = encoder.encode(`${req.method}|${req.path}|${timestampHeader}|${jtiHeader}`);
  const signatureBytes = Buffer.from(signatureHeader, "base64");
  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64"); // Stored as Base64 encoded 32-byte Ed25519 public key.

  if (signatureBytes.length !== 64 || publicKeyBytes.length !== 32) {
    metricsDeviceProofFailed("INVALID_SIGNATURE");
    return { ok: false, reason: "INVALID_SIGNATURE", deviceId };
  }

  try {
    const valid = await verify(signatureBytes, message, publicKeyBytes);
    if (!valid) {
      metricsDeviceProofFailed("INVALID_SIGNATURE");
      return { ok: false, reason: "INVALID_SIGNATURE", deviceId };
    }
  } catch {
    metricsDeviceProofFailed("INVALID_SIGNATURE");
    return { ok: false, reason: "INVALID_SIGNATURE", deviceId };
  }

  return { ok: true, deviceId };
}

/**
 * rejectDeviceProof
 *
 * Sends a standardised RFC7807 rejection for failed device proofs.
 */
export function rejectDeviceProof(res: Response, reason: DeviceProofRejectionReason): void {
  const problem = createDeviceProofProblem(reason);
  res.status(403).type("application/problem+json").json(problem);
}
