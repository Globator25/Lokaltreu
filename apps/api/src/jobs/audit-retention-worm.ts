import { createJobDbClient } from "./db.js";

async function main() {
  const retentionDays = process.env.AUDIT_RETENTION_DAYS
    ? Number(process.env.AUDIT_RETENTION_DAYS)
    : undefined;
  const now = new Date();
  const effectiveRetentionDays = retentionDays ?? 180;
  const cutoff = new Date(now.getTime() - effectiveRetentionDays * 24 * 60 * 60 * 1000);
  const db = await createJobDbClient();
  try {
    type DeletedCountRow = { deleted_count: number | string };
    const result = await db.query<DeletedCountRow>(
      `
      WITH deleted AS (
        DELETE FROM audit_log_worm
        WHERE ts < $1
        RETURNING 1
      )
      SELECT COUNT(*) AS deleted_count FROM deleted
      `,
      [cutoff],
    );
    const deletedCountRaw = result.rows[0]?.deleted_count ?? 0;
    const deletedCount = typeof deletedCountRaw === "string" ? Number(deletedCountRaw) : deletedCountRaw;
    console.warn("audit retention pruned", {
      deleted_count: deletedCount,
    });
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error("audit retention job failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
