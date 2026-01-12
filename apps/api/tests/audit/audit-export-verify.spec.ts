import crypto from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signEd25519Bytes } from "../../src/modules/audit/export/crypto.js";
import { fingerprintPemUtf8RawSha256 } from "../../src/modules/audit/export/fingerprint.js";
import { verifyAuditExportDir } from "../../src/jobs/audit-export-verify.js";

type EventRow = {
  tenant_id: string;
  seq: number;
  ts: string;
  action: string;
  result: string;
  prev_hash: string;
  hash: string;
};

function sha256HexFromString(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function buildEventHash(row: Omit<EventRow, "hash">): string {
  const payload = JSON.stringify({
    tenant_id: row.tenant_id,
    seq: row.seq,
    ts: row.ts,
    action: row.action,
    result: row.result,
    prev_hash: row.prev_hash,
  });
  return sha256HexFromString(payload);
}

function createTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "audit-verify-"));
}

function writeArtifacts(params: {
  dir: string;
  events: EventRow[];
  metaOverrides?: Partial<{ object_key_prefix: string; fingerprint: string }>;
  privateKeyPem: string;
  publicKeyPem: string;
}): { publicKeyPath: string } {
  const eventsLines = params.events.map((row) => JSON.stringify(row)).join("\n");
  const eventsBytes = Buffer.from(eventsLines, "utf8");
  const eventsSha256 = crypto.createHash("sha256").update(eventsBytes).digest("hex");
  const eventsLinesCount = eventsLines.length === 0 ? 0 : eventsLines.split("\n").length;

  const publicPemRaw = params.publicKeyPem;
  const fingerprint = params.metaOverrides?.fingerprint ?? fingerprintPemUtf8RawSha256(publicPemRaw);

  const meta = {
    schema_version: "1",
    tenant_id: "tenant-1",
    from_seq: 1,
    to_seq: 2,
    exported_at: "2026-01-12T00:00:00.000Z",
    object_key_prefix: params.metaOverrides?.object_key_prefix ?? "audit/tenant=tenant-1/date=2026-01-12/from_1_to_2",
    signature: {
      alg: "Ed25519",
      key_id: "test-key",
      sig_encoding: "base64",
      sig_format: "ed25519-raw-64bytes-base64",
      public_key_fingerprint_sha256: fingerprint,
      public_key_fingerprint_format: "sha256(pem-utf8-raw)",
    },
    artifacts: {
      events: {
        path: "events.ndjson",
        sha256: eventsSha256,
        bytes: eventsBytes.byteLength,
        lines: eventsLinesCount,
      },
      meta: { path: "meta.json" },
      sig: { path: "meta.sig", encoding: "base64" },
    },
    chain: {
      hash_alg: "sha256",
      start_prev_hash: "",
      end_hash: params.events[params.events.length - 1]?.hash ?? "",
    },
  };

  const metaBytes = Buffer.from(JSON.stringify(meta), "utf8");
  const signature = signEd25519Bytes({
    messageBytes: metaBytes,
    privateKeyPem: params.privateKeyPem,
  }).signatureBase64Text;

  writeFileSync(path.join(params.dir, "events.ndjson"), eventsBytes);
  writeFileSync(path.join(params.dir, "meta.json"), metaBytes);
  writeFileSync(path.join(params.dir, "meta.sig"), signature);
  writeFileSync(path.join(params.dir, "public-key.pem"), publicPemRaw);

  return { publicKeyPath: path.join(params.dir, "public-key.pem") };
}

function createBaseEvents(): EventRow[] {
  const tenant = "tenant-1";
  const ts = "2026-01-12T00:00:00.000Z";
  const base = {
    tenant_id: tenant,
    ts,
    action: "admin.login",
    result: "SUCCESS",
  };
  const first = {
    ...base,
    seq: 1,
    prev_hash: "",
  } as Omit<EventRow, "hash">;
  const firstHash = buildEventHash(first);
  const second = {
    ...base,
    seq: 2,
    prev_hash: firstHash,
  } as Omit<EventRow, "hash">;
  const secondHash = buildEventHash(second);
  return [
    { ...first, hash: firstHash },
    { ...second, hash: secondHash },
  ];
}

describe("audit export verify", () => {
  it("verify ok", async () => {
    const dir = createTempDir();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const events = createBaseEvents();
    const { publicKeyPath } = writeArtifacts({
      dir,
      events,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    });

    const result = await verifyAuditExportDir({ dir, publicKeyPath });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("fails on modified meta", async () => {
    const dir = createTempDir();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const events = createBaseEvents();
    const { publicKeyPath } = writeArtifacts({
      dir,
      events,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    });

    const metaPath = path.join(dir, "meta.json");
    const metaBytes = readFileSync(metaPath, "utf8");
    const modified = metaBytes.replace("from_1_to_2", "from_1_to_3");
    writeFileSync(metaPath, modified);

    const result = await verifyAuditExportDir({ dir, publicKeyPath });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.summary.signature_valid).toBe(false);
  });

  it("fails on modified events", async () => {
    const dir = createTempDir();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const events = createBaseEvents();
    const { publicKeyPath } = writeArtifacts({
      dir,
      events,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    });

    const eventsPath = path.join(dir, "events.ndjson");
    const eventsBytes = readFileSync(eventsPath, "utf8");
    writeFileSync(eventsPath, `${eventsBytes}\n{"tenant_id":"tenant-1","seq":3,"ts":"2026-01-12T00:00:00.000Z","action":"admin.login","result":"SUCCESS","prev_hash":"x","hash":"y"}`);

    const result = await verifyAuditExportDir({ dir, publicKeyPath });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.summary.ndjson_valid).toBe(false);
  });

  it("fails on broken chain", async () => {
    const dir = createTempDir();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const events = createBaseEvents();
    const broken = [
      events[0],
      { ...events[1], prev_hash: "broken" },
    ];
    const { publicKeyPath } = writeArtifacts({
      dir,
      events: broken,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    });

    const result = await verifyAuditExportDir({ dir, publicKeyPath });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.summary.chain_valid).toBe(false);
  });

  it("fails on wrong fingerprint", async () => {
    const dir = createTempDir();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const events = createBaseEvents();
    const { publicKeyPath } = writeArtifacts({
      dir,
      events,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
      metaOverrides: { fingerprint: fingerprintPemUtf8RawSha256(`${publicKey}\n`) },
    });

    const result = await verifyAuditExportDir({ dir, publicKeyPath });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.summary.fingerprint_valid).toBe(false);
  });
});
