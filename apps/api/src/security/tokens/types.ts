// AccessTokenPayload beschreibt den Inhalt eines kurzfristigen Access Tokens (≤15 min gültig)
export interface AccessTokenPayload {
  sub: string;        // subject = Benutzer- oder Admin-ID (pseudonymisiert pro Mandant)
  tenantId: string;   // Mandant
  role: string;       // z.B. "admin"
  exp: number;        // Ablauf (Unix-Timestamp in Sekunden)
  jti: string;        // eindeutige ID für Replay-Schutz
}

// RefreshTokenPayload beschreibt Refresh Tokens (≤30 Tage gültig)
export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  rotationId: string; // erlaubt Refresh-Rotation/Invalidierung
  exp: number;
  jti: string;
}
