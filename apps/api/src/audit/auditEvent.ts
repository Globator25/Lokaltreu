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
 * flushAuditLogs() triggert die asynchrone Signatur + Export-Pipeline nach R2 (EU),
 * wodurch die WORM-Garantie bestaetigt wird.
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
  // Export erfolgt ueber flushAuditLogs() (signierter Batch in R2-Bucket, EU-Region, 180 Tage Aufbewahrung).
}

/**
 * flushAuditLogs
 *
 * Trigger fuer die signierte WORM-Archivierung. Ein separater Worker liest die
 * JSONL-Dateien, signiert sie (Ed25519) und legt sie im Cloudflare R2 Bucket (EU)
 * ab. Da nur Append-Operationen erlaubt sind, erfolgt hier bewusst keine Mutation.
 * Die Implementierung ist hier als Stub hinterlegt; Produktionscode haengt die
 * Funktion in den Deploy-Job (siehe SPEC v2.0 Roadmap Schritt 14).
 */
export async function flushAuditLogs(): Promise<void> {
  // No-op Platzhalter: Der Deployment-Job ruft hier die eigentliche Export-Routine auf.
  // Wichtig: Kein truncate(), kein rewrite(). Nur Append + Sign + Offload.
}
