import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { AuditExportRepository, AuditWormRow } from "./audit-export.repo.js";

export type AuditExportJobDeps = {
  repo: AuditExportRepository;
  storage: AuditExportStorage;
  signer: AuditExportSigner;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  now?: () => Date;
  batchSize?: number;
  schemaVersion?: string;
  hashAlg?: string;
};

export type AuditExportStorage = {
  putObject: (params: {
    key: string;
    body: string | Buffer;
    contentType: string;
  }) => Promise<void>;
};

export type AuditExportSigner = {
  keyId: string;
  sign: (payload: string | Buffer) => string;
};

type AuditExportMeta = {
  tenant_id: string;
  from_seq: number;
  to_seq: number;
  exported_at: string;
  record_count: number;
  hash_alg: string;
  key_id: string;
  schema_version: string;
};

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return "null";
}

function sanitizeErrorMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 256);
}

function buildNdjson(rows: AuditWormRow[]): string {
  return rows
    .map((row) =>
      JSON.stringify({
        tenant_id: row.tenantId,
        seq: row.seq,
        ts: row.ts.toISOString(),
        action: row.action,
        result: row.result,
        device_id: row.deviceId,
        card_id: row.cardId,
        jti: row.jti,
        correlation_id: row.correlationId,
        prev_hash: row.prevHash,
        hash: row.hash,
      }),
    )
    .join("\n");
}

function buildPrefix(params: { tenantId: string; date: Date; basePrefix: string }): string {
  const datePart = params.date.toISOString().slice(0, 10);
  const base = params.basePrefix.replace(/\/+$/, "");
  return `${base}/tenant=${params.tenantId}/date=${datePart}`;
}

export async function runAuditExportJob(params: {
  deps: AuditExportJobDeps;
  basePrefix: string;
  tenants?: string[];
}): Promise<{ exportedTenants: number; exportedRuns: number }> {
  const now = params.deps.now ?? (() => new Date());
  const batchSize = params.deps.batchSize ?? 500;
  const schemaVersion = params.deps.schemaVersion ?? "1";
  const hashAlg = params.deps.hashAlg ?? "sha256";
  const tenants = params.tenants ?? (await params.deps.repo.listTenants());
  let exportedRuns = 0;

  for (const tenantId of tenants) {
    const maxSeq = await params.deps.repo.getMaxSeq(tenantId);
    if (!maxSeq) {
      continue;
    }
    const lastSuccess = await params.deps.repo.getLastSuccess(tenantId);
    let nextFrom = (lastSuccess?.toSeq ?? 0) + 1;
    if (nextFrom > maxSeq) {
      continue;
    }

    while (nextFrom <= maxSeq) {
      const toSeq = Math.min(nextFrom + batchSize - 1, maxSeq);
      const runId = randomUUID();
      const run = await params.deps.repo.createRun({
        runId,
        tenantId,
        fromSeq: nextFrom,
        toSeq,
      });
      if (!run) {
        params.deps.logger?.warn?.("audit export run skipped (duplicate range)", {
          tenant_id: tenantId,
          from_seq: nextFrom,
          to_seq: toSeq,
        });
        nextFrom = toSeq + 1;
        continue;
      }

      try {
        const rows = await params.deps.repo.getWormEvents(tenantId, nextFrom, toSeq);
        const exportedAt = now();
        const prefix = buildPrefix({ tenantId, date: exportedAt, basePrefix: params.basePrefix });
        const baseKey = `${prefix}/from_${nextFrom}_to_${toSeq}`;
        const ndjson = buildNdjson(rows);
        const meta: AuditExportMeta = {
          tenant_id: tenantId,
          from_seq: nextFrom,
          to_seq: toSeq,
          exported_at: exportedAt.toISOString(),
          record_count: rows.length,
          hash_alg: hashAlg,
          key_id: params.deps.signer.keyId,
          schema_version: schemaVersion,
        };
        const metaJson = canonicalJson(meta);
        const signature = params.deps.signer.sign(metaJson);

        await params.deps.storage.putObject({
          key: `${baseKey}/events.ndjson`,
          body: ndjson,
          contentType: "application/x-ndjson",
        });
        await params.deps.storage.putObject({
          key: `${baseKey}/meta.json`,
          body: metaJson,
          contentType: "application/json",
        });
        await params.deps.storage.putObject({
          key: `${baseKey}/meta.sig`,
          body: signature,
          contentType: "application/octet-stream",
        });

        await params.deps.repo.markSuccess({
          runId,
          exportedAt,
          objectKey: baseKey,
        });

        params.deps.logger?.info?.("audit export run success", {
          tenant_id: tenantId,
          from_seq: nextFrom,
          to_seq: toSeq,
        });
        exportedRuns += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await params.deps.repo.markFailed({
          runId,
          errorCode: "EXPORT_FAILED",
          errorMessageSanitized: sanitizeErrorMessage(message),
        });
        params.deps.logger?.error?.("audit export run failed", {
          tenant_id: tenantId,
          from_seq: nextFrom,
          to_seq: toSeq,
        });
        throw error;
      }

      nextFrom = toSeq + 1;
    }
  }

  return { exportedTenants: tenants.length, exportedRuns };
}

export function createEd25519Signer(params: { keyId: string; privateKeyPem: string }): AuditExportSigner {
  const key = crypto.createPrivateKey(params.privateKeyPem);
  return {
    keyId: params.keyId,
    sign(payload: string | Buffer) {
      const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
      const signature = crypto.sign(null, data, key);
      return signature.toString("base64");
    },
  };
}
