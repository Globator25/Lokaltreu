import {
  createEd25519Signer,
  runAuditExportJob,
} from "../modules/audit/export/audit-export.job.js";
import type {
  AuditExportRepository,
  AuditExportRun,
  AuditWormRow,
} from "../modules/audit/export/audit-export.repo.js";
import { createS3Client } from "../modules/audit/export/s3-storage.js";
import { createJobDbClient } from "./db.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function loadPrivateKey(raw: string): string {
  if (raw.includes("BEGIN")) {
    return raw;
  }
  return Buffer.from(raw, "base64").toString("utf8");
}

async function main() {
  const db = await createJobDbClient();
  try {
    const repo: AuditExportRepository = {
      async listTenants() {
        type TenantRow = { tenant_id: string };
        const result = await db.query<TenantRow>(`SELECT DISTINCT tenant_id FROM audit_log_worm`);
        return result.rows.map((row) => row.tenant_id);
      },
      async getMaxSeq(tenantId) {
        type MaxSeqRow = { max_seq: number | string | null };
        const result = await db.query<MaxSeqRow>(
          `
          SELECT MAX(seq) AS max_seq
          FROM audit_log_worm
          WHERE tenant_id = $1
          `,
          [tenantId],
        );
        const raw = result.rows[0]?.max_seq ?? null;
        if (raw == null) {
          return null;
        }
        return typeof raw === "string" ? Number(raw) : raw;
      },
      async getLastSuccess(tenantId) {
        type RunRow = {
          run_id: string;
          tenant_id: string;
          from_seq: number | string;
          to_seq: number | string;
          status: string;
          exported_at: Date | string | null;
          object_key: string | null;
          error_code: string | null;
          error_message_sanitized: string | null;
          created_at: Date | string;
        };
        const result = await db.query<RunRow>(
          `
          SELECT
            run_id,
            tenant_id,
            from_seq,
            to_seq,
            status,
            exported_at,
            object_key,
            error_code,
            error_message_sanitized,
            created_at
          FROM audit_export_runs
          WHERE tenant_id = $1 AND status = 'SUCCESS'
          ORDER BY to_seq DESC
          LIMIT 1
          `,
          [tenantId],
        );
        const row = result.rows[0];
        if (!row) {
          return null;
        }
        const mapped: AuditExportRun = {
          runId: row.run_id,
          tenantId: row.tenant_id,
          fromSeq: typeof row.from_seq === "string" ? Number(row.from_seq) : row.from_seq,
          toSeq: typeof row.to_seq === "string" ? Number(row.to_seq) : row.to_seq,
          status: row.status as AuditExportRun["status"],
          exportedAt: row.exported_at ? new Date(row.exported_at) : null,
          objectKey: row.object_key,
          errorCode: row.error_code,
          errorMessageSanitized: row.error_message_sanitized,
          createdAt: new Date(row.created_at),
        };
        return mapped;
      },
      async getWormEvents(tenantId, fromSeq, toSeq) {
        type WormRowDb = {
          tenant_id: string;
          seq: number | string;
          ts: Date | string;
          action: string;
          result: string;
          device_id: string | null;
          card_id: string | null;
          jti: string | null;
          correlation_id: string | null;
          prev_hash: string | null;
          hash: string;
        };
        const result = await db.query<WormRowDb>(
          `
          SELECT
            tenant_id,
            seq,
            ts,
            action,
            result,
            device_id,
            card_id,
            jti,
            correlation_id,
            prev_hash,
            hash
          FROM audit_log_worm
          WHERE tenant_id = $1 AND seq BETWEEN $2 AND $3
          ORDER BY seq ASC
          `,
          [tenantId, fromSeq, toSeq],
        );
        return result.rows.map((row): AuditWormRow => ({
          tenantId: row.tenant_id,
          seq: typeof row.seq === "string" ? Number(row.seq) : row.seq,
          ts: new Date(row.ts),
          action: row.action,
          result: row.result,
          deviceId: row.device_id,
          cardId: row.card_id,
          jti: row.jti,
          correlationId: row.correlation_id,
          prevHash: row.prev_hash,
          hash: row.hash,
        }));
      },
      async createRun(params) {
        type RunRow = {
          run_id: string;
          tenant_id: string;
          from_seq: number | string;
          to_seq: number | string;
          status: string;
          exported_at: Date | string | null;
          object_key: string | null;
          error_code: string | null;
          error_message_sanitized: string | null;
          created_at: Date | string;
        };
        const result = await db.query<RunRow>(
          `
          INSERT INTO audit_export_runs (
            run_id,
            tenant_id,
            from_seq,
            to_seq,
            status
          )
          VALUES ($1, $2, $3, $4, 'STARTED')
          ON CONFLICT (tenant_id, from_seq, to_seq) DO NOTHING
          RETURNING
            run_id,
            tenant_id,
            from_seq,
            to_seq,
            status,
            exported_at,
            object_key,
            error_code,
            error_message_sanitized,
            created_at
          `,
          [params.runId, params.tenantId, params.fromSeq, params.toSeq],
        );
        const row = result.rows[0];
        if (!row) {
          return null;
        }
        const mapped: AuditExportRun = {
          runId: row.run_id,
          tenantId: row.tenant_id,
          fromSeq: typeof row.from_seq === "string" ? Number(row.from_seq) : row.from_seq,
          toSeq: typeof row.to_seq === "string" ? Number(row.to_seq) : row.to_seq,
          status: row.status as AuditExportRun["status"],
          exportedAt: row.exported_at ? new Date(row.exported_at) : null,
          objectKey: row.object_key,
          errorCode: row.error_code,
          errorMessageSanitized: row.error_message_sanitized,
          createdAt: new Date(row.created_at),
        };
        return mapped;
      },
      async markSuccess(params) {
        await db.query(
          `
          UPDATE audit_export_runs
          SET status = 'SUCCESS', exported_at = $2, object_key = $3
          WHERE run_id = $1
          `,
          [params.runId, params.exportedAt, params.objectKey],
        );
      },
      async markFailed(params) {
        await db.query(
          `
          UPDATE audit_export_runs
          SET status = 'FAILED', error_code = $2, error_message_sanitized = $3
          WHERE run_id = $1
          `,
          [params.runId, params.errorCode, params.errorMessageSanitized],
        );
      },
    };
    const storage = createS3Client({
      bucket: requireEnv("AUDIT_EXPORT_S3_BUCKET"),
      region: requireEnv("AUDIT_EXPORT_S3_REGION"),
      accessKeyId: requireEnv("AUDIT_EXPORT_S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("AUDIT_EXPORT_S3_SECRET_ACCESS_KEY"),
      endpoint: process.env.AUDIT_EXPORT_S3_ENDPOINT || undefined,
      pathStyle: process.env.AUDIT_EXPORT_S3_PATH_STYLE !== "false",
    });
    const signer = createEd25519Signer({
      keyId: requireEnv("AUDIT_EXPORT_KEY_ID"),
      privateKeyPem: loadPrivateKey(requireEnv("AUDIT_EXPORT_PRIVATE_KEY")),
    });

    const batchSize = process.env.AUDIT_EXPORT_BATCH_SIZE
      ? Number(process.env.AUDIT_EXPORT_BATCH_SIZE)
      : undefined;
    const schemaVersion = process.env.AUDIT_EXPORT_SCHEMA_VERSION || undefined;
    const tenants = process.env.AUDIT_EXPORT_TENANTS
      ? process.env.AUDIT_EXPORT_TENANTS.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;

    const basePrefix = process.env.AUDIT_EXPORT_PREFIX || "audit";

    await runAuditExportJob({
      deps: {
        repo,
        storage,
        signer,
        batchSize,
        schemaVersion,
        logger: console,
      },
      basePrefix,
      tenants,
    });
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error("audit export job failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
