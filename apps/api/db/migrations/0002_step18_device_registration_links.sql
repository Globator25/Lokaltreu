-- Step 18: Device onboarding (expand-only, no destructive changes).
-- This migration adds device_registration_links with token_hash only (no plaintext tokens).

CREATE TABLE IF NOT EXISTS device_registration_links (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    device_id uuid NULL REFERENCES devices(id) ON DELETE SET NULL,
    created_by_admin_id uuid NULL REFERENCES admins(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_registration_links_tenant_created_idx
    ON device_registration_links (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS device_registration_links_expires_at_idx
    ON device_registration_links (expires_at);
