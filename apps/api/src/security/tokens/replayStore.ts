// Anti-Replay-Store basierend auf SETNX-Logik.
// In Production wird dieser Store gegen Upstash Redis (EU-Region) implementiert.
// Hier nur eine lokale In-Memory-Version für dev. Kein Klartext-Secret nötig.

export interface ReplayStore {
  checkAndSetJti(jti: string, ttlSeconds: number): Promise<boolean>;
  // true  -> jti war neu, Request darf weiterlaufen
  // false -> jti existierte schon, Replay-Versuch blockieren
}

// InMemoryReplayStore simuliert Redis SETNX(jti) + TTL.
class InMemoryReplayStore implements ReplayStore {
  private seen = new Map<string, number>();

  async checkAndSetJti(jti: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now() / 1000;
    if (this.seen.has(jti)) {
      // jti wurde schon einmal verwendet -> Replay blocken
      return false;
    }
    // jti registrieren mit Ablauf (TTL)
    this.seen.set(jti, now + ttlSeconds);
    return true;
  }
}

export const replayStore: ReplayStore = new InMemoryReplayStore();
