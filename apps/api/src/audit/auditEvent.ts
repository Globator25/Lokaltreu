import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface AuditRecord {
  type: string;
  at: string;
  actorDeviceId?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

const AUDIT_DIR = "./var/audit";

/**
 * auditEvent
 *
 * Persists audit records append-only and prepares them for export to immutable
 * storage. Retention: 180 Tage. Export nach R2 Buckets in EU-Jurisdiction.
 * SPEC v2.0: secure_action.ok / secure_action.blocked_replay muessen hier als
 * WORM-Append landen (Anti-Replay Forensik).
 * Audit-Events sind append-only (keine Ueberschreibung).
 */
export async function auditEvent(event: AuditRecord): Promise<void> {
  await mkdir(AUDIT_DIR, { recursive: true });
  const ts = new Date().toISOString();
  const file = path.join(AUDIT_DIR, `${ts.slice(0, 10)}.log.jsonl`);
  const line = JSON.stringify({
    ts,
    ...event,
  });
  // Timestamp wird einmal erzeugt und wiederverwendet. Das macht Audit-Eintraege deterministischer und stabiler fuer spaetere Forensik.
  // append-only, no overwrite
  await appendFile(file, `${line}\n`, { encoding: "utf8" });
  // TODO: Export to R2 bucket in EU region with 180 day retention (WORM).
}
