import type { DbClientLike } from "../../../repositories/referrals.repo.js";
import type {
  AuditExportRepository,
  AuditExportRun,
  AuditWormRow,
} from "./audit-export.repo.js";

type AuditExportRunRow = {
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

type AuditWormRowDb = {
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

const mapRun = (row: AuditExportRunRow): AuditExportRun => ({
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
});

const mapWormRow = (row: AuditWormRowDb): AuditWormRow => ({
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
});

export function createDbAuditExportRepository(db: DbClientLike): AuditExportRepository {
  return {
    async listTenants() {
      const result = await db.query<{ tenant_id: string }>(
        `SELECT DISTINCT tenant_id FROM audit_log_worm`,
      );
      return result.rows.map((row) => row.tenant_id);
    },

    async getMaxSeq(tenantId) {
      const result = await db.query<{ max_seq: number | string | null }>(
        `
        SELECT MAX(seq) AS max_seq
        FROM audit_log_worm
        WHERE tenant_id = $1
        `,
        [tenantId],
      );
      if (result.rowCount === 0) {
        return null;
      }
      const raw = result.rows[0]?.max_seq;
      if (raw == null) {
        return null;
      }
      return typeof raw === "string" ? Number(raw) : raw;
    },

    async getLastSuccess(tenantId) {
      const result = await db.query<AuditExportRunRow>(
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
      if (result.rowCount === 0) {
        return null;
      }
      return mapRun(result.rows[0]);
    },

    async getWormEvents(tenantId, fromSeq, toSeq) {
      const result = await db.query<AuditWormRowDb>(
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
      return result.rows.map(mapWormRow);
    },

    async createRun(params) {
      const result = await db.query<AuditExportRunRow>(
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
      if (result.rowCount === 0) {
        return null;
      }
      return mapRun(result.rows[0]);
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
}
