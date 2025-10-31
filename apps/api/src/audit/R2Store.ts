import type { AuditRecord } from "./auditEvent.js";

export interface AuditBundleStore {
  flush(bundle: Uint8Array, records: AuditRecord[]): Promise<void>;
}

/**
 * R2Store handles exporting audit bundles to immutable object storage.
 * retentionPolicyDays = 180.
 */
export class R2Store implements AuditBundleStore {
  private readonly retentionPolicyDays = 180;

  /**
   * Bundle wird signiert (integrity hash + timestamp) und dann hochgeladen.
   * Die Upload-Implementierung MUSS in Produktion mit R2 (EU-Jurisdiction only)
   * erfolgen, inklusive WORM-Retention von 180 Tagen.
   */
  async flush(bundle: Uint8Array, records: AuditRecord[]): Promise<void> {
    const ts = new Date().toISOString();
    const signature = this.signBundle(bundle, ts);
    void records;
    void signature;
    void bundle;
    // TODO: Upload bundle + signature to R2 (EU region only) with retentionPolicyDays applied.
  }

  /**
   * signBundle() erzeugt einen Integritaetsnachweis fuer das Audit-Bundle.
   * - Berechne Hash (z. B. SHA-256) des Bundle-Inhalts.
   * - Schreibe Timestamp.
   * - Diese Signatur wird gemeinsam mit dem Bundle in R2 persistiert.
   * MUSS in Produktion kryptografisch nachvollziehbar sein.
   */
  private signBundle(bundle: Uint8Array, ts: string): { hash: string; ts: string } {
    void bundle;
    // TODO: echte Hash-Berechnung (SHA-256) implementieren
    return { hash: "TODO_HASH", ts };
  }
}
