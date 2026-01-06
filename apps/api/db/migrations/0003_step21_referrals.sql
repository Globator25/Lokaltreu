-- Step 21: Referrals (expand-only, no destructive changes).

CREATE TABLE IF NOT EXISTS referrals (
    code text PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    referrer_card_id text NOT NULL,
    referred_card_id text NULL,
    qualified boolean NOT NULL DEFAULT false,
    first_stamp_at timestamptz NULL,
    bonus_credited_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_qualified_unique
    ON referrals (tenant_id, referred_card_id)
    WHERE qualified = true;

CREATE INDEX IF NOT EXISTS referrals_referrer_velocity_idx
    ON referrals (tenant_id, referrer_card_id, qualified, first_stamp_at DESC);

CREATE TABLE IF NOT EXISTS card_first_stamps (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    card_id text NOT NULL,
    first_stamp_at timestamptz NOT NULL,
    PRIMARY KEY (tenant_id, card_id)
);
