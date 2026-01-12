import {
  checkAuditExportGaps,
  InMemoryAuditGapCounter,
} from "../modules/audit/export/audit-export.monitor.js";
import type { AuditExportRepository, AuditExportRun } from "../modules/audit/export/audit-export.repo.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJobDbClient } from "./db.js";

export function parseTenantFilter(value: string | undefined): string[] | undefined {
  const tenants = value
    ?.split(",")
    .map((tenant) => tenant.trim())
    .filter(Boolean);
  return tenants && tenants.length > 0 ? tenants : undefined;
}

export function exitCodeForGapEvents(gapEvents: number): number {
  return gapEvents > 0 ? 2 : 0;
}

async function alertWebhook(payload: unknown): Promise<void> {
  const url = process.env.AUDIT_EXPORT_ALERT_WEBHOOK_URL;
  if (!url) {
    return;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("audit export webhook failed", {
        status: response.status,
        status_text: response.statusText,
        error: text.slice(0, 256),
      });
    }
  } catch (error) {
    console.warn("audit export webhook error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function runGapCheck() {
  const counter = new InMemoryAuditGapCounter();
  const db = await createJobDbClient();
  try {
    const tenantFilter = parseTenantFilter(process.env.AUDIT_EXPORT_TENANTS);
    const repo: AuditExportRepository = {
      async listTenants() {
        if (tenantFilter) {
          return tenantFilter;
        }
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
    process.exitCode = exitCodeForGapEvents(summary.gapEvents);
  } finally {
    await db.close();
  }
}

async function main() {
  await runGapCheck();
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  void main().catch((error) => {
    console.error("audit export gap check failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
