import crypto from "node:crypto";

export function sha256HexFromBytes(input: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function fingerprintPemUtf8RawSha256(pemUtf8Raw: string): string {
  return crypto.createHash("sha256").update(pemUtf8Raw, "utf8").digest("hex");
}

export function fingerprintSpkiDerSha256(publicKeyPem: string): string {
  const der = crypto.createPublicKey(publicKeyPem).export({ format: "der", type: "spki" });
  return sha256HexFromBytes(Buffer.from(der));
}
