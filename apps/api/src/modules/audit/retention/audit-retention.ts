export type AuditRetentionDeps = {
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>;
  };
  now?: () => Date;
  retentionDays?: number;
  logger?: {
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

export async function pruneAuditLogWorm(
  deps: AuditRetentionDeps,
): Promise<{ deletedCount: number; cutoff: Date }> {
  const now = deps.now ?? (() => new Date());
  const retentionDays = deps.retentionDays ?? 180;
  const cutoff = new Date(now().getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await deps.db.query(
    `DELETE FROM audit_log_worm WHERE ts < $1`,
    [cutoff],
  );
  deps.logger?.warn?.("audit retention pruned", {
    deleted_count: result.rowCount,
  });
  return { deletedCount: result.rowCount, cutoff };
}
