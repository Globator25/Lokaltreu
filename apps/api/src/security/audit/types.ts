// AuditEvent beschreibt sicherheitsrelevante Aktionen.
// Diese Events werden WORM geschrieben und später nach EU-R2 exportiert (Retention 180 Tage).
export interface AuditEvent {
  at: string;          // ISO-8601 Zeitstempel
  tenantId: string;
  actorId: string;     // z.B. Admin-User oder System
  action: string;      // z.B. "ADMIN_LOGIN", "REWARD_REDEEM", "RATE_LIMIT_HIT"
  detail: Record<string, unknown>; // Kontextdetails
  ip?: string;         // optionale IP für Security-Forensik
  deviceId?: string;   // korrelierbar mit DeviceProof
}
