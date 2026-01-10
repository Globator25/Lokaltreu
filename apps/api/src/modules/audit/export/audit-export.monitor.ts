import { randomUUID } from "node:crypto";
import type { AuditExportRepository } from "./audit-export.repo.js";

export type AuditExportGapAlert = {
  tenantId: string;
  gapSeconds: number;
  lastSuccessAt: string | null;
  checkedAt: string;
  correlationId: string;
};

export type AuditExportGapMonitorDeps = {
  repo: AuditExportRepository;
  now?: () => Date;
  gapMinutes?: number;
  logger?: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };
  alertHook?: (alert: AuditExportGapAlert) => Promise<void> | void;
  counter?: { increment: () => void };
};

export type AuditExportGapSummary = {
  gapEvents: number;
  worstGapSeconds: number;
  tenantsChecked: number;
};

export async function checkAuditExportGaps(
  deps: AuditExportGapMonitorDeps,
): Promise<AuditExportGapSummary> {
  const now = deps.now ?? (() => new Date());
  const gapSecondsLimit = Math.max(1, (deps.gapMinutes ?? 15) * 60);
  const tenants = await deps.repo.listTenants();
  let gapEvents = 0;
  let worstGapSeconds = 0;

  for (const tenantId of tenants) {
    const maxSeq = await deps.repo.getMaxSeq(tenantId);
    if (!maxSeq) {
      continue;
    }
    const lastSuccess = await deps.repo.getLastSuccess(tenantId);
    const checkedAt = now();
    const lastSuccessAt = lastSuccess?.exportedAt ?? null;
    const gapSeconds = lastSuccessAt
      ? Math.floor((checkedAt.getTime() - lastSuccessAt.getTime()) / 1000)
      : gapSecondsLimit + 1;

    if (gapSeconds > gapSecondsLimit) {
      gapEvents += 1;
      worstGapSeconds = Math.max(worstGapSeconds, gapSeconds);
      deps.counter?.increment();
      const alert: AuditExportGapAlert = {
        tenantId,
        gapSeconds,
        lastSuccessAt: lastSuccessAt ? lastSuccessAt.toISOString() : null,
        checkedAt: checkedAt.toISOString(),
        correlationId: randomUUID(),
      };
      deps.logger?.error?.("audit export gap exceeded", {
        tenant_id: tenantId,
        gap_seconds: gapSeconds,
        correlation_id: alert.correlationId,
      });
      await deps.alertHook?.(alert);
    } else {
      deps.logger?.warn?.("audit export gap ok", {
        tenant_id: tenantId,
        gap_seconds: gapSeconds,
      });
    }
  }

  return { gapEvents, worstGapSeconds, tenantsChecked: tenants.length };
}

export class InMemoryAuditGapCounter {
  private count = 0;

  increment(): void {
    this.count += 1;
  }

  get value(): number {
    return this.count;
  }
}
