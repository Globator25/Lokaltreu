import crypto from "node:crypto";

export function sha256Hex(buffer: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function verifyEd25519SignatureBytes(params: {
  messageBytes: Uint8Array;
  signatureBase64Text: string;
  publicKeyPem: string;
}): boolean {
  const signature = Buffer.from(params.signatureBase64Text.trim(), "base64");
  if (signature.length !== 64) {
    return false;
  }
  return crypto.verify(null, Buffer.from(params.messageBytes), params.publicKeyPem, signature);
}

export function signEd25519Bytes(params: {
  messageBytes: Uint8Array;
  privateKeyPem: string;
}): { signatureBase64Text: string } {
  const signature = crypto.sign(null, Buffer.from(params.messageBytes), params.privateKeyPem);
  return { signatureBase64Text: signature.toString("base64") };
}
