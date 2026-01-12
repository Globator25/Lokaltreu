import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sha256Hex,
  verifyEd25519SignatureBytes,
} from "../modules/audit/export/crypto.js";
import { fingerprintPemUtf8RawSha256 } from "../modules/audit/export/fingerprint.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type VerifySummary = {
  ok: boolean;
  reason?: string;
  signature_valid: boolean;
  fingerprint_valid: boolean;
  ndjson_valid: boolean;
  chain_valid: boolean;
  computed: {
    signature_bytes_len?: number;
    fingerprint_sha256?: string;
    events_sha256?: string;
    events_bytes?: number;
    events_lines?: number;
  };
  expected: {
    fingerprint_sha256?: string;
    events_sha256?: string;
    events_bytes?: number;
    events_lines?: number;
  };
};

type AuditExportMeta = {
  signature: {
    public_key_fingerprint_sha256: string;
  };
  artifacts: {
    events: {
      sha256: string;
      bytes: number;
      lines: number;
    };
  };
  chain: {
    start_prev_hash: string | null;
    end_hash: string;
  };
};

type CliArgs = {
  dir?: string;
  pub?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value) {
      continue;
    }
    if (value.startsWith("--dir=")) {
      args.dir = value.slice("--dir=".length);
      continue;
    }
    if (value === "--dir") {
      args.dir = argv[i + 1];
      i += 1;
      continue;
    }
    if (value.startsWith("--pub=")) {
      args.pub = value.slice("--pub=".length);
      continue;
    }
    if (value === "--pub") {
      args.pub = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: { [key: string]: JsonValue }, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`META_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

function getNumber(record: { [key: string]: JsonValue }, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`META_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

function getNullableString(record: { [key: string]: JsonValue }, key: string): string | null {
  const value = record[key];
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`META_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

function parseMetaBytes(metaBytes: Uint8Array): AuditExportMeta {
  const text = new TextDecoder().decode(metaBytes);
  const parsed = JSON.parse(text) as JsonValue;
  if (!isRecord(parsed)) {
    throw new Error("META_INVALID");
  }
  const signatureValue = parsed.signature;
  if (!isRecord(signatureValue)) {
    throw new Error("META_SIGNATURE_INVALID");
  }
  const artifactsValue = parsed.artifacts;
  if (!isRecord(artifactsValue)) {
    throw new Error("META_ARTIFACTS_INVALID");
  }
  const eventsValue = artifactsValue.events;
  if (!isRecord(eventsValue)) {
    throw new Error("META_ARTIFACTS_EVENTS_INVALID");
  }
  const chainValue = parsed.chain;
  if (!isRecord(chainValue)) {
    throw new Error("META_CHAIN_INVALID");
  }
  return {
    signature: {
      public_key_fingerprint_sha256: getString(signatureValue, "public_key_fingerprint_sha256"),
    },
    artifacts: {
      events: {
        sha256: getString(eventsValue, "sha256"),
        bytes: getNumber(eventsValue, "bytes"),
        lines: getNumber(eventsValue, "lines"),
      },
    },
    chain: {
      start_prev_hash: getNullableString(chainValue, "start_prev_hash"),
      end_hash: getString(chainValue, "end_hash"),
    },
  };
}

function parseNdjsonEvents(eventsBytes: Uint8Array): Array<{ prev_hash: string | null; hash: string }> {
  const text = new TextDecoder().decode(eventsBytes);
  if (text.length === 0) {
    return [];
  }
  const lines = text.split("\n").filter((line) => line.length > 0);
  return lines.map((line) => {
    const parsed = JSON.parse(line) as JsonValue;
    if (!isRecord(parsed)) {
      throw new Error("EVENT_JSON_INVALID");
    }
    const hash = getString(parsed, "hash");
    const prevHash = getNullableString(parsed, "prev_hash");
    return { hash, prev_hash: prevHash };
  });
}

function computeEventsInfo(eventsBytes: Uint8Array): { sha256: string; bytes: number; lines: number } {
  const hash = sha256Hex(Buffer.from(eventsBytes));
  const text = new TextDecoder().decode(eventsBytes);
  const lines = text.length === 0 ? 0 : text.split("\n").length;
  return { sha256: hash, bytes: eventsBytes.byteLength, lines };
}

function validateChain(meta: AuditExportMeta, events: Array<{ prev_hash: string | null; hash: string }>): string | null {
  if (events.length === 0) {
    return "CHAIN_EMPTY";
  }
  if (events[0].prev_hash !== meta.chain.start_prev_hash) {
    return "CHAIN_START_MISMATCH";
  }
  if (events[events.length - 1].hash !== meta.chain.end_hash) {
    return "CHAIN_END_MISMATCH";
  }
  for (let i = 1; i < events.length; i += 1) {
    if (events[i].prev_hash !== events[i - 1].hash) {
      return "CHAIN_LINK_MISMATCH";
    }
  }
  return null;
}

export async function verifyAuditExportDir(params: {
  dir: string;
  publicKeyPath: string;
}): Promise<{ ok: boolean; exitCode: 0 | 1 | 2; summary: VerifySummary }> {
  const metaPath = path.join(params.dir, "meta.json");
  const sigPath = path.join(params.dir, "meta.sig");
  const eventsPath = path.join(params.dir, "events.ndjson");

  try {
    const [metaBytes, sigText, eventsBytes, publicKeyPem] = await Promise.all([
      readFile(metaPath),
      readFile(sigPath, "utf8"),
      readFile(eventsPath),
      readFile(params.publicKeyPath, "utf8"),
    ]);

    const signatureValid = verifyEd25519SignatureBytes({
      messageBytes: new Uint8Array(metaBytes),
      signatureBase64Text: sigText,
      publicKeyPem,
    });
    if (!signatureValid) {
      const summary: VerifySummary = {
        ok: false,
        reason: "signature_invalid",
        signature_valid: false,
        fingerprint_valid: false,
        ndjson_valid: false,
        chain_valid: false,
        computed: {
          signature_bytes_len: Buffer.from(sigText.trim(), "base64").length,
        },
        expected: {},
      };
      return { ok: false, exitCode: 2, summary };
    }

    const meta = parseMetaBytes(new Uint8Array(metaBytes));
    const computedFingerprint = fingerprintPemUtf8RawSha256(publicKeyPem);
    const fingerprintValid = computedFingerprint === meta.signature.public_key_fingerprint_sha256;
    if (!fingerprintValid) {
      const summary: VerifySummary = {
        ok: false,
        reason: "fingerprint_invalid",
        signature_valid: true,
        fingerprint_valid: false,
        ndjson_valid: false,
        chain_valid: false,
        computed: { fingerprint_sha256: computedFingerprint },
        expected: { fingerprint_sha256: meta.signature.public_key_fingerprint_sha256 },
      };
      return { ok: false, exitCode: 2, summary };
    }

    const computedEvents = computeEventsInfo(new Uint8Array(eventsBytes));
    const ndjsonValid =
      computedEvents.sha256 === meta.artifacts.events.sha256 &&
      computedEvents.bytes === meta.artifacts.events.bytes &&
      computedEvents.lines === meta.artifacts.events.lines;
    if (!ndjsonValid) {
      const summary: VerifySummary = {
        ok: false,
        reason: "events_invalid",
        signature_valid: true,
        fingerprint_valid: true,
        ndjson_valid: false,
        chain_valid: false,
        computed: {
          events_sha256: computedEvents.sha256,
          events_bytes: computedEvents.bytes,
          events_lines: computedEvents.lines,
        },
        expected: {
          events_sha256: meta.artifacts.events.sha256,
          events_bytes: meta.artifacts.events.bytes,
          events_lines: meta.artifacts.events.lines,
        },
      };
      return { ok: false, exitCode: 2, summary };
    }

    const chainError = validateChain(meta, parseNdjsonEvents(new Uint8Array(eventsBytes)));
    if (chainError) {
      const summary: VerifySummary = {
        ok: false,
        reason: "chain_invalid",
        signature_valid: true,
        fingerprint_valid: true,
        ndjson_valid: true,
        chain_valid: false,
        computed: {},
        expected: {},
      };
      return { ok: false, exitCode: 2, summary };
    }

    const summary: VerifySummary = {
      ok: true,
      signature_valid: true,
      fingerprint_valid: true,
      ndjson_valid: true,
      chain_valid: true,
      computed: {
        fingerprint_sha256: computedFingerprint,
        events_sha256: computedEvents.sha256,
        events_bytes: computedEvents.bytes,
        events_lines: computedEvents.lines,
      },
      expected: {
        fingerprint_sha256: meta.signature.public_key_fingerprint_sha256,
        events_sha256: meta.artifacts.events.sha256,
        events_bytes: meta.artifacts.events.bytes,
        events_lines: meta.artifacts.events.lines,
      },
    };
    return { ok: true, exitCode: 0, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errno = (error as NodeJS.ErrnoException).code;
    const reason =
      errno === "ENOENT"
        ? "missing_file"
        : message.startsWith("META_")
          ? "meta_invalid"
          : message.startsWith("EVENT_")
            ? "events_parse_invalid"
            : "io_error";
    const summary: VerifySummary = {
      ok: false,
      reason,
      signature_valid: false,
      fingerprint_valid: false,
      ndjson_valid: false,
      chain_valid: false,
      computed: {},
      expected: {},
    };
    return { ok: false, exitCode: reason === "missing_file" || reason === "io_error" ? 1 : 2, summary };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.pub) {
    console.warn("audit export verify failed", { ok: false, reason: "usage" });
    process.exitCode = 1;
    return;
  }
  const result = await verifyAuditExportDir({ dir: args.dir, publicKeyPath: args.pub });
  if (result.ok) {
    console.warn("audit export verify ok", result.summary);
  } else {
    console.error("audit export verify failed", result.summary);
  }
  process.exitCode = result.exitCode;
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  void main().catch((error) => {
    console.error("audit export verify failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
