import {
  checkAuditExportGaps,
  InMemoryAuditGapCounter,
} from "../modules/audit/export/audit-export.monitor.js";
import type { AuditExportRepository, AuditExportRun } from "../modules/audit/export/audit-export.repo.js";
import { createJobDbClient } from "./db.js";

async function alertWebhook(payload: unknown): Promise<void> {
  const url = process.env.AUDIT_EXPORT_ALERT_WEBHOOK_URL;
  if (!url) {
    return;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`alert webhook failed: ${response.status} ${text}`);
  }
}

async function main() {
  const counter = new InMemoryAuditGapCounter();
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
      getWormEvents() {
        return Promise.resolve([]);
      },
      createRun() {
        return Promise.resolve(null);
      },
      markSuccess() {
        return Promise.resolve();
      },
      markFailed() {
        return Promise.resolve();
      },
    };
    const gapMinutes = process.env.AUDIT_EXPORT_GAP_MINUTES
      ? Number(process.env.AUDIT_EXPORT_GAP_MINUTES)
      : undefined;
    const summary = await checkAuditExportGaps({
      repo,
      gapMinutes,
      counter,
      logger: console,
      alertHook: alertWebhook,
    });
    console.warn("audit export gap summary", {
      gap_events: summary.gapEvents,
      worst_gap_seconds: summary.worstGapSeconds,
      tenants_checked: summary.tenantsChecked,
      audit_gaps_count: counter.value,
    });
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error("audit export gap check failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
