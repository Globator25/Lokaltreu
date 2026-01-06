import sodium from "libsodium-wrappers";

type CanonicalMessageInput = {
  method: string;
  path: string;
  timestamp: string;
  jti: string;
};

type VerifyDeviceSignatureInput = {
  publicKey: string;
  signature: string;
  message: string;
};

export async function initSodium(): Promise<void> {
  await sodium.ready;
}

export function buildCanonicalMessage(input: CanonicalMessageInput): string {
  // SPEC: method|path|ts|jti (exact order)
  return `${input.method}|${input.path}|${input.timestamp}|${input.jti}`;
}

export function verifyDeviceSignature(input: VerifyDeviceSignatureInput): boolean {
  const publicKeyBytes = sodium.from_base64(input.publicKey, sodium.base64_variants.ORIGINAL);
  const signatureBytes = sodium.from_base64(input.signature, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(input.message);
  return sodium.crypto_sign_verify_detached(signatureBytes, messageBytes, publicKeyBytes);
}
