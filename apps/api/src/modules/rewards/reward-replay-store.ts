export interface RewardReplayStore {
  /**
   * Attempts to reserve a reward-token JTI for one-time use.
   * @returns true if the JTI was reserved, false if it was already used.
   */
  consume(params: { tenantId: string; jti: string; ttlSeconds: number }): Promise<boolean>;
}

type ReplayKey = string;

export class InMemoryRewardReplayStore implements RewardReplayStore {
  private readonly entries = new Map<ReplayKey, number>();

  private keyOf(tenantId: string, jti: string): ReplayKey {
    return `${tenantId}:${jti}`;
  }

  consume(params: { tenantId: string; jti: string; ttlSeconds: number }): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.max(1, Math.floor(params.ttlSeconds));
    const key = this.keyOf(params.tenantId, params.jti);

    const currentExpiry = this.entries.get(key);
    if (currentExpiry && currentExpiry <= now) {
      this.entries.delete(key);
    }

    if (this.entries.has(key)) {
      return Promise.resolve(false);
    }

    this.entries.set(key, expiresAt);
    return Promise.resolve(true);
  }
}
