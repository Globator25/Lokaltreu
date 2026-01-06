import crypto from "node:crypto";

export type ReferralRecord = {
  code: string;
  tenantId: string;
  referrerCardId: string;
  referredCardId: string | null;
  qualified: boolean;
  firstStampAt: Date | null;
  bonusCreditedAt: Date | null;
  createdAt: Date;
};

export interface DbClientLike {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}

export type DbTransactionLike = DbClientLike;

export interface ReferralRepository {
  findByCode(code: string, tx?: DbTransactionLike): Promise<ReferralRecord | null>;
  findActiveByReferrer(
    tenantId: string,
    referrerCardId: string,
    tx?: DbTransactionLike,
  ): Promise<ReferralRecord | null>;
  createReferralCode(
    params: { tenantId: string; referrerCardId: string; code: string },
    tx?: DbTransactionLike,
  ): Promise<ReferralRecord>;
  qualifyReferral(
    params: { tenantId: string; code: string; referredCardId: string; firstStampAt: Date },
    tx?: DbTransactionLike,
  ): Promise<boolean>;
  markBonusCredited(
    params: { tenantId: string; code: string; creditedAt: Date },
    tx?: DbTransactionLike,
  ): Promise<boolean>;
  countQualifiedForMonth(
    params: { tenantId: string; referrerCardId: string; monthStart: Date; monthEnd: Date },
    tx?: DbTransactionLike,
  ): Promise<number>;
  hasFirstStamp(
    params: { tenantId: string; cardId: string },
    tx?: DbTransactionLike,
  ): Promise<boolean>;
  markFirstStampIfAbsent(
    params: { tenantId: string; cardId: string; firstStampAt: Date },
    tx?: DbTransactionLike,
  ): Promise<boolean>;
}

const cloneRecord = (record: ReferralRecord): ReferralRecord => ({
  ...record,
  firstStampAt: record.firstStampAt ? new Date(record.firstStampAt) : null,
  bonusCreditedAt: record.bonusCreditedAt ? new Date(record.bonusCreditedAt) : null,
  createdAt: new Date(record.createdAt),
});

export class InMemoryReferralRepository implements ReferralRepository {
  private readonly byCode = new Map<string, ReferralRecord>();
  private readonly byReferrer = new Map<string, string[]>();
  private readonly cardFirstStamps = new Map<string, Date>();

  private referrerKey(tenantId: string, referrerCardId: string): string {
    return `${tenantId}:${referrerCardId}`;
  }

  findByCode(code: string, _tx?: DbTransactionLike): Promise<ReferralRecord | null> {
    void _tx;
    const record = this.byCode.get(code);
    return Promise.resolve(record ? cloneRecord(record) : null);
  }

  findActiveByReferrer(
    tenantId: string,
    referrerCardId: string,
    _tx?: DbTransactionLike,
  ): Promise<ReferralRecord | null> {
    void _tx;
    const key = this.referrerKey(tenantId, referrerCardId);
    const codes = this.byReferrer.get(key) ?? [];
    for (let i = codes.length - 1; i >= 0; i -= 1) {
      const code = codes[i];
      const record = this.byCode.get(code);
      if (record && !record.qualified) {
        return Promise.resolve(cloneRecord(record));
      }
    }
    return Promise.resolve(null);
  }

  createReferralCode(
    params: { tenantId: string; referrerCardId: string; code: string },
    _tx?: DbTransactionLike,
  ): Promise<ReferralRecord> {
    void _tx;
    if (this.byCode.has(params.code)) {
      throw new Error("referrals code must be unique");
    }
    const record: ReferralRecord = {
      code: params.code,
      tenantId: params.tenantId,
      referrerCardId: params.referrerCardId,
      referredCardId: null,
      qualified: false,
      firstStampAt: null,
      bonusCreditedAt: null,
      createdAt: new Date(),
    };
    this.byCode.set(params.code, record);
    const key = this.referrerKey(params.tenantId, params.referrerCardId);
    const existing = this.byReferrer.get(key) ?? [];
    existing.push(params.code);
    this.byReferrer.set(key, existing);
    return Promise.resolve(cloneRecord(record));
  }

  qualifyReferral(
    params: { tenantId: string; code: string; referredCardId: string; firstStampAt: Date },
    _tx?: DbTransactionLike,
  ): Promise<boolean> {
    void _tx;
    const record = this.byCode.get(params.code);
    if (!record || record.tenantId !== params.tenantId || record.qualified) {
      return Promise.resolve(false);
    }
    record.qualified = true;
    record.referredCardId = params.referredCardId;
    record.firstStampAt = new Date(params.firstStampAt);
    return Promise.resolve(true);
  }

  markBonusCredited(
    params: { tenantId: string; code: string; creditedAt: Date },
    _tx?: DbTransactionLike,
  ): Promise<boolean> {
    void _tx;
    const record = this.byCode.get(params.code);
    if (!record || record.tenantId !== params.tenantId || record.bonusCreditedAt) {
      return Promise.resolve(false);
    }
    record.bonusCreditedAt = new Date(params.creditedAt);
    return Promise.resolve(true);
  }

  countQualifiedForMonth(
    params: { tenantId: string; referrerCardId: string; monthStart: Date; monthEnd: Date },
    _tx?: DbTransactionLike,
  ): Promise<number> {
    void _tx;
    let count = 0;
    for (const record of this.byCode.values()) {
      if (!record.qualified || record.tenantId !== params.tenantId) {
        continue;
      }
      if (record.referrerCardId !== params.referrerCardId) {
        continue;
      }
      if (!record.firstStampAt) {
        continue;
      }
      const ts = record.firstStampAt.getTime();
      if (ts >= params.monthStart.getTime() && ts < params.monthEnd.getTime()) {
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  hasFirstStamp(
    params: { tenantId: string; cardId: string },
    _tx?: DbTransactionLike,
  ): Promise<boolean> {
    void _tx;
    const key = this.referrerKey(params.tenantId, params.cardId);
    return Promise.resolve(this.cardFirstStamps.has(key));
  }

  markFirstStampIfAbsent(
    params: { tenantId: string; cardId: string; firstStampAt: Date },
    _tx?: DbTransactionLike,
  ): Promise<boolean> {
    void _tx;
    const key = this.referrerKey(params.tenantId, params.cardId);
    if (this.cardFirstStamps.has(key)) {
      return Promise.resolve(false);
    }
    this.cardFirstStamps.set(key, new Date(params.firstStampAt));
    return Promise.resolve(true);
  }
}

export function generateReferralCode(): string {
  return crypto.randomBytes(24).toString("base64url");
}
