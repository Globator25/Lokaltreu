// apps/api/src/modules/auth/device-replay-store.ts

export interface DeviceReplayStore {
  /**
   * Versucht, eine (tenantId, deviceId, jti) Kombination zu konsumieren.
   * @returns true, wenn JTI neu ist und jetzt reserviert wurde.
   *          false, wenn sie bereits existiert (Replay).
   */
  consume(params: {
    tenantId: string;
    deviceId: string;
    jti: string;
    expiresAt: number; // Unix-Timestamp (Sekunden)
  }): Promise<boolean>;
}

type ReplayKey = string;

/**
 * Einfache In-Memory-Implementierung für Tests / lokale Entwicklung.
 * In Produktion kann dies z. B. durch Redis o. Ä. ersetzt werden.
 */
export class InMemoryDeviceReplayStore implements DeviceReplayStore {
  private readonly entries = new Map<ReplayKey, number>();

  private keyOf(tenantId: string, deviceId: string, jti: string): ReplayKey {
    return `${tenantId}:${deviceId}:${jti}`;
  }

  // Nicht async, sondern explizit Promise zurückgeben → kein require-await-Verstoß
  consume(params: {
    tenantId: string;
    deviceId: string;
    jti: string;
    expiresAt: number;
  }): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const key = this.keyOf(params.tenantId, params.deviceId, params.jti);

    // Abgelaufene Einträge opportunistisch aufräumen
    const currentExpiry = this.entries.get(key);
    if (currentExpiry && currentExpiry <= now) {
      this.entries.delete(key);
    }

    if (this.entries.has(key)) {
      // bereits verwendet → Replay
      return Promise.resolve(false);
    }

    // neuen Eintrag mit Expiry setzen
    this.entries.set(key, params.expiresAt);
    return Promise.resolve(true);
  }
}
