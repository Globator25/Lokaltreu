import type {
  DbClientLike,
  DbTransactionLike,
  ReferralRecord,
  ReferralRepository,
} from "./referrals.repo.js";

type ReferralRow = {
  code: string;
  tenant_id: string;
  referrer_card_id: string;
  referred_card_id: string | null;
  qualified: boolean;
  first_stamp_at: string | Date | null;
  bonus_credited_at: string | Date | null;
  created_at: string | Date;
};

const mapRow = (row: ReferralRow): ReferralRecord => ({
  code: row.code,
  tenantId: row.tenant_id,
  referrerCardId: row.referrer_card_id,
  referredCardId: row.referred_card_id,
  qualified: row.qualified,
  firstStampAt: row.first_stamp_at ? new Date(row.first_stamp_at) : null,
  bonusCreditedAt: row.bonus_credited_at ? new Date(row.bonus_credited_at) : null,
  createdAt: new Date(row.created_at),
});

const getClient = (db: DbClientLike, tx?: DbTransactionLike): DbClientLike =>
  tx ?? db;

export const createDbReferralRepository = (db: DbClientLike): ReferralRepository => ({
  async findByCode(code, tx) {
    const client = getClient(db, tx);
    const result = await client.query<ReferralRow>(
      `
      SELECT
        code,
        tenant_id,
        referrer_card_id,
        referred_card_id,
        qualified,
        first_stamp_at,
        bonus_credited_at,
        created_at
      FROM referrals
      WHERE code = $1
      `,
      [code],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  },

  async findActiveByReferrer(tenantId, referrerCardId, tx) {
    const client = getClient(db, tx);
    const result = await client.query<ReferralRow>(
      `
      SELECT
        code,
        tenant_id,
        referrer_card_id,
        referred_card_id,
        qualified,
        first_stamp_at,
        bonus_credited_at,
        created_at
      FROM referrals
      WHERE tenant_id = $1 AND referrer_card_id = $2 AND qualified = false
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId, referrerCardId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  },

  async createReferralCode(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<ReferralRow>(
      `
      INSERT INTO referrals (
        code,
        tenant_id,
        referrer_card_id
      )
      VALUES ($1, $2, $3)
      RETURNING
        code,
        tenant_id,
        referrer_card_id,
        referred_card_id,
        qualified,
        first_stamp_at,
        bonus_credited_at,
        created_at
      `,
      [params.code, params.tenantId, params.referrerCardId],
    );
    return mapRow(result.rows[0]);
  },

  async qualifyReferral(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<ReferralRow>(
      `
      UPDATE referrals
      SET
        qualified = true,
        referred_card_id = $3,
        first_stamp_at = $4
      WHERE code = $1 AND tenant_id = $2 AND qualified = false
      `,
      [params.code, params.tenantId, params.referredCardId, params.firstStampAt],
    );
    return result.rowCount > 0;
  },

  async markBonusCredited(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<ReferralRow>(
      `
      UPDATE referrals
      SET bonus_credited_at = $3
      WHERE code = $1 AND tenant_id = $2 AND qualified = true AND bonus_credited_at IS NULL
      `,
      [params.code, params.tenantId, params.creditedAt],
    );
    return result.rowCount > 0;
  },

  async countQualifiedForMonth(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<{ count: number | string }>(
      `
      SELECT COUNT(*)::int AS count
      FROM referrals
      WHERE tenant_id = $1
        AND referrer_card_id = $2
        AND qualified = true
        AND first_stamp_at >= $3
        AND first_stamp_at < $4
      `,
      [params.tenantId, params.referrerCardId, params.monthStart, params.monthEnd],
    );
    if (result.rowCount === 0) {
      return 0;
    }
    const raw = result.rows[0]?.count;
    return typeof raw === "string" ? Number(raw) : raw ?? 0;
  },

  async hasFirstStamp(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<{ card_id: string }>(
      `
      SELECT card_id
      FROM card_first_stamps
      WHERE tenant_id = $1 AND card_id = $2
      `,
      [params.tenantId, params.cardId],
    );
    return result.rowCount > 0;
  },

  async markFirstStampIfAbsent(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<{ tenant_id: string }>(
      `
      INSERT INTO card_first_stamps (
        tenant_id,
        card_id,
        first_stamp_at
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, card_id) DO NOTHING
      RETURNING tenant_id
      `,
      [params.tenantId, params.cardId, params.firstStampAt],
    );
    return result.rowCount > 0;
  },
});
