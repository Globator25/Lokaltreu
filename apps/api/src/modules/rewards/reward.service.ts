import { hashToken } from "../../handlers/http-utils.js";
import type { RewardReplayStore } from "./reward-replay-store.js";

export type CardState = {
  currentStamps: number;
  stampsRequired: number;
  rewardsAvailable: number;
};

export type RewardTokenRecord = {
  id: string; // JTI
  tenantId: string;
  deviceId: string;
  cardId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export interface RewardTokenStore {
  createToken(params: {
    id: string;
    tenantId: string;
    deviceId: string;
    cardId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RewardTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RewardTokenRecord | null>;
  /**
   * Atomically marks the token as used; returns false if already used.
   */
  markUsed(id: string, usedAt: Date): Promise<boolean>;
}

export class InMemoryRewardTokenStore implements RewardTokenStore {
  private readonly records = new Map<string, RewardTokenRecord>();
  private readonly idByTokenHash = new Map<string, string>();

  createToken(params: {
    id: string;
    tenantId: string;
    deviceId: string;
    cardId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RewardTokenRecord> {
    const record: RewardTokenRecord = {
      id: params.id,
      tenantId: params.tenantId,
      deviceId: params.deviceId,
      cardId: params.cardId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.records.set(record.id, record);
    this.idByTokenHash.set(record.tokenHash, record.id);
    return Promise.resolve(record);
  }

  findByTokenHash(tokenHash: string): Promise<RewardTokenRecord | null> {
    const id = this.idByTokenHash.get(tokenHash);
    if (!id) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.records.get(id) ?? null);
  }

  markUsed(id: string, usedAt: Date): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.usedAt) {
      return Promise.resolve(false);
    }
    record.usedAt = usedAt;
    return Promise.resolve(true);
  }
}

export interface RewardCardStateStore {
  get(cardId: string): CardState;
  redeemReward(cardId: string): CardState;
}

export class InMemoryRewardCardStateStore implements RewardCardStateStore {
  private readonly cards = new Map<string, CardState>();

  get(cardId: string): CardState {
    const state = this.cards.get(cardId) ?? {
      currentStamps: 0,
      stampsRequired: 5,
      rewardsAvailable: 0,
    };
    return { ...state };
  }

  redeemReward(cardId: string): CardState {
    const existing = this.get(cardId);
    const next: CardState = {
      currentStamps: existing.currentStamps,
      stampsRequired: existing.stampsRequired,
      rewardsAvailable: Math.max(0, existing.rewardsAvailable - 1),
    };
    this.cards.set(cardId, next);
    return { ...next };
  }

  seed(cardId: string, state: CardState): void {
    this.cards.set(cardId, { ...state });
  }
}

export class RewardTokenExpiredError extends Error {
  constructor(message = "Reward token expired or invalid") {
    super(message);
    this.name = "RewardTokenExpiredError";
  }
}

export class RewardTokenReuseError extends Error {
  constructor(message = "Reward token already used") {
    super(message);
    this.name = "RewardTokenReuseError";
  }
}

export interface RewardService {
  redeemReward(params: { redeemToken: string }): Promise<{ cardState: CardState }>;
}

export interface RewardServiceDeps {
  tokenStore: RewardTokenStore;
  cardStore: RewardCardStateStore;
  replayStore?: RewardReplayStore;
  transaction?: {
    run: <T>(fn: () => Promise<T>) => Promise<T>;
  };
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  audit?: {
    log: (event: string, payload: Record<string, unknown>) => Promise<void> | void;
  };
}

export function createRewardService(deps: RewardServiceDeps): RewardService {
  const runInTransaction = deps.transaction?.run ?? (async (fn) => fn());
  return {
    async redeemReward(params) {
      return runInTransaction(async () => {
        const tokenHash = hashToken(params.redeemToken);
        const record = await deps.tokenStore.findByTokenHash(tokenHash);
        if (!record || record.expiresAt.getTime() <= Date.now()) {
          throw new RewardTokenExpiredError();
        }

        if (deps.replayStore) {
          try {
            const expiresAtSeconds = Math.floor(record.expiresAt.getTime() / 1000);
            const nowSeconds = Math.floor(Date.now() / 1000);
            const ttlSeconds = Math.max(1, expiresAtSeconds - nowSeconds);
            const ok = await deps.replayStore.consume({
              tenantId: record.tenantId,
              jti: record.id,
              ttlSeconds,
            });
            if (!ok) {
              throw new RewardTokenReuseError();
            }
          } catch (error) {
            deps.logger?.warn?.("reward replay store unavailable", {
              tenantId: record.tenantId,
              deviceId: record.deviceId,
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        }

        if (record.usedAt) {
          throw new RewardTokenReuseError();
        }
        const marked = await deps.tokenStore.markUsed(record.id, new Date());
        if (!marked) {
          throw new RewardTokenReuseError();
        }

        const cardState = deps.cardStore.redeemReward(record.cardId);

        await deps.audit?.log("reward.redeemed", {
          tenant_id: record.tenantId,
          device_id: record.deviceId,
          card_id: record.cardId,
        });

        deps.logger?.info?.("reward redeemed", {
          tenant_id: record.tenantId,
          device_id: record.deviceId,
          card_id: record.cardId,
        });

        return { cardState };
      });
    },
  };
}
