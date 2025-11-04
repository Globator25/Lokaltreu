import { randomUUID } from "node:crypto";
import type { Request } from "express";
import * as nacl from "tweetnacl";
import { problem } from "../lib/problem.js";

const MAX_SKEW_MS = 30_000;

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(Buffer.from(normalized, "base64"));
};

export interface DeviceProofContext {
  request: Request;
  devicePublicKey: string;
  jti: string;
  onVerified?: (deviceId: string) => void;
}

export type DeviceProofNext = () => Promise<unknown>;

function readHeader(req: Request, name: string): string | undefined {
  const viaGet = req.get(name);
  if (viaGet && viaGet.trim().length > 0) {
    return viaGet;
  }
  const raw = req.headers[name.toLowerCase() as keyof typeof req.headers];
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  return undefined;
}

export async function verifyDeviceProof(ctx: DeviceProofContext, next: DeviceProofNext): Promise<void> {
  const req = ctx.request;
  const proofHeader = readHeader(req, "x-device-proof");
  const timestampHeader = readHeader(req, "x-device-timestamp");
  const deviceId = readHeader(req, "x-device-id") ?? "unknown-device";

  if (!proofHeader || !timestampHeader) {
    throw problem({
      type: "https://errors.lokaltreu.example/device/missing-proof",
      title: "Device proof required",
      status: 401,
      error_code: "DEVICE_PROOF_INVALID",
      correlation_id: randomUUID(),
      detail: "Missing X-Device-Proof or X-Device-Timestamp headers.",
    });
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    throw problem({
      type: "https://errors.lokaltreu.example/device/invalid-timestamp",
      title: "Invalid device proof timestamp",
      status: 403,
      error_code: "DEVICE_PROOF_INVALID",
      correlation_id: randomUUID(),
      detail: "Timestamp header must be a unix epoch in milliseconds.",
    });
  }

  const skew = Math.abs(Date.now() - timestamp);
  if (skew > MAX_SKEW_MS) {
    throw problem({
      type: "https://errors.lokaltreu.example/device/proof-time",
      title: "Device proof timestamp skew",
      status: 403,
      error_code: "DEVICE_PROOF_INVALID_TIME",
      correlation_id: randomUUID(),
      detail: "Device proof timestamp outside ±30 seconds window.",
    });
  }

  const message = new TextEncoder().encode(
    `${req.method.toUpperCase()}|${req.path}|${timestampHeader}|${ctx.jti}`,
  );

  let signature: Uint8Array;
  let publicKey: Uint8Array;
  try {
    signature = decodeBase64Url(proofHeader);
    publicKey = decodeBase64Url(ctx.devicePublicKey);
  } catch {
    throw problem({
      type: "https://errors.lokaltreu.example/device/invalid-proof",
      title: "Invalid device proof encoding",
      status: 403,
      error_code: "DEVICE_PROOF_INVALID",
      correlation_id: randomUUID(),
      detail: "Ed25519 proof must be base64url encoded.",
    });
  }

  const valid = nacl.sign.detached.verify(message, signature, publicKey);
  if (!valid) {
    throw problem({
      type: "https://errors.lokaltreu.example/device/invalid-proof",
      title: "Invalid device proof",
      status: 403,
      error_code: "DEVICE_PROOF_INVALID",
      correlation_id: randomUUID(),
      detail: "Signature verification failed.",
    });
  }

  ctx.onVerified?.(deviceId);
  await next();
}
