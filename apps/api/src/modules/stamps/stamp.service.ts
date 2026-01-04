import crypto from "node:crypto";
import { hashToken } from "../../handlers/http-utils.js";

export type StampTokenRecord = {
  id: string;
  tenantId?: string;
  deviceId?: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type CardState = {
  currentStamps: number;
  stampsRequired: number;
  rewardsAvailable: number;
};

export type StampClaimResponse = {
  cardState: CardState;
  offer: { title: string; body: string | null } | null;
};

export interface StampTokenStore {
  createToken(params: {
    id: string;
    tenantId?: string;
    deviceId?: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<StampTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<StampTokenRecord | null>;
  markUsed(id: string, usedAt: Date): Promise<boolean>;
}

export interface CardStateStore {
  applyStamp(cardId: string): CardState;
}

export class InMemoryStampTokenStore implements StampTokenStore {
  private readonly records = new Map<string, StampTokenRecord>();
  private readonly idByTokenHash = new Map<string, string>();

  createToken(params: {
    id: string;
    tenantId?: string;
    deviceId?: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<StampTokenRecord> {
    const record: StampTokenRecord = {
      id: params.id,
      tenantId: params.tenantId,
      deviceId: params.deviceId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.records.set(record.id, record);
    this.idByTokenHash.set(record.tokenHash, record.id);
    return Promise.resolve(record);
  }

  findByTokenHash(tokenHash: string): Promise<StampTokenRecord | null> {
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

export class InMemoryCardStateStore implements CardStateStore {
  private readonly cards = new Map<string, CardState>();

  applyStamp(cardId: string): CardState {
    const existing = this.cards.get(cardId) ?? {
      currentStamps: 0,
      stampsRequired: DEFAULT_STAMPS_REQUIRED,
      rewardsAvailable: 0,
    };
    const next: CardState = {
      currentStamps: existing.currentStamps,
      stampsRequired: existing.stampsRequired,
      rewardsAvailable: existing.rewardsAvailable,
    };
    next.currentStamps += 1;
    if (next.currentStamps >= next.stampsRequired) {
      next.currentStamps = 0;
      next.rewardsAvailable += 1;
    }
    this.cards.set(cardId, next);
    return { ...next };
  }
}

export class StampTokenExpiredError extends Error {
  constructor(message = "Stamp token expired or invalid") {
    super(message);
    this.name = "StampTokenExpiredError";
  }
}

export class StampTokenReuseError extends Error {
  constructor(message = "Stamp token already used") {
    super(message);
    this.name = "StampTokenReuseError";
  }
}

export interface StampService {
  createToken(params: { tenantId?: string; deviceId?: string }): Promise<{
    qrToken: string;
    jti: string;
    expiresAt: Date;
  }>;
  claimStamp(params: {
    qrToken: string;
    cardId: string;
    ref?: string | null;
  }): Promise<StampClaimResponse>;
}

export interface StampServiceDeps {
  tokenStore: StampTokenStore;
  cardStore: CardStateStore;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  audit?: {
    log: (event: string, payload: Record<string, unknown>) => Promise<void> | void;
  };
}

const STAMP_TOKEN_TTL_MS = 60 * 1000;
const DEFAULT_STAMPS_REQUIRED = 5;

function generateQrToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createStampService(deps: StampServiceDeps): StampService {
  return {
    async createToken(params) {
      const qrToken = generateQrToken();
      const tokenHash = hashToken(qrToken);
      const jti = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + STAMP_TOKEN_TTL_MS);

      await deps.tokenStore.createToken({
        id: jti,
        tenantId: params.tenantId,
        deviceId: params.deviceId,
        tokenHash,
        expiresAt,
      });

      await deps.audit?.log("stamps.token.created", {
        tenantId: params.tenantId,
        deviceId: params.deviceId,
        jti,
        expiresAt: expiresAt.toISOString(),
      });

      deps.logger?.info?.("stamps token created", {
        tenantId: params.tenantId,
        deviceId: params.deviceId,
        jti,
      });

      return { qrToken, jti, expiresAt };
    },

    async claimStamp(params) {
      const tokenHash = hashToken(params.qrToken);
      const record = await deps.tokenStore.findByTokenHash(tokenHash);

      if (!record || record.expiresAt.getTime() <= Date.now()) {
        throw new StampTokenExpiredError();
      }
      if (record.usedAt) {
        throw new StampTokenReuseError();
      }
      const marked = await deps.tokenStore.markUsed(record.id, new Date());
      if (!marked) {
        throw new StampTokenReuseError();
      }

      const cardState = deps.cardStore.applyStamp(params.cardId);

      await deps.audit?.log("stamps.claimed", {
        tenantId: record.tenantId,
        deviceId: record.deviceId,
        cardId: params.cardId,
        tokenId: record.id,
      });

      deps.logger?.info?.("stamp claimed", {
        tenantId: record.tenantId,
        deviceId: record.deviceId,
      });

      return {
        cardState,
        offer: null,
      };
    },
  };
}
