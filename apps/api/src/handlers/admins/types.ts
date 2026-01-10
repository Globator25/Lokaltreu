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
  event: string;
  tenantId: string;
  adminId?: string;
  deviceId?: string;
  cardId?: string;
  correlationId: string;
  ip?: string;
  ua?: string;
  jti?: string;
  meta?: Record<string, unknown>;
  at: number;
};

export interface AuditSink {
  audit(event: AuditEvent): Promise<void> | void;
}
