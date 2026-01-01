export type AdminSession = {
  refreshTokenHash: string;
  tenantId: string;
  adminId: string;
  expiresAt: number;
  revokedAt?: number;
  rotatedAt?: number;
};

export interface AdminSessionStore {
  create(session: AdminSession): void;
  findByHash(refreshTokenHash: string): AdminSession | undefined;
  rotate(refreshTokenHash: string, next: AdminSession): void;
  revoke(refreshTokenHash: string): void;
}

export type AuditEvent = {
  event: "admin.register" | "admin.login" | "admin.token_refresh" | "admin.logout";
  tenantId: string;
  adminId: string;
  correlationId: string;
  ip?: string;
  ua?: string;
  at: number;
};

export interface AuditSink {
  audit(event: AuditEvent): void;
}
