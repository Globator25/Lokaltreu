-- Step 24: WORM Audit Log (expand-only, no destructive changes).

CREATE TABLE IF NOT EXISTS audit_log_worm (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    seq bigint NOT NULL,
    ts timestamptz NOT NULL DEFAULT now(),
    action text NOT NULL,
    result text NOT NULL,
    device_id text NULL,
    card_id text NULL,
    jti text NULL,
    correlation_id text NULL,
    prev_hash text NULL,
    hash text NOT NULL,
    PRIMARY KEY (tenant_id, seq),
    CONSTRAINT audit_log_worm_action_format CHECK (action ~ '^[a-z0-9_.-]{1,80}$'),
    CONSTRAINT audit_log_worm_result_format CHECK (result ~ '^[A-Z_]{1,32}$'),
    CONSTRAINT audit_log_worm_device_id_len CHECK (device_id IS NULL OR length(device_id) <= 128),
    CONSTRAINT audit_log_worm_card_id_len CHECK (card_id IS NULL OR length(card_id) <= 128),
    CONSTRAINT audit_log_worm_jti_len CHECK (jti IS NULL OR length(jti) <= 128),
    CONSTRAINT audit_log_worm_corr_len CHECK (correlation_id IS NULL OR length(correlation_id) <= 128),
    CONSTRAINT audit_log_worm_hash_len CHECK (length(hash) <= 128),
    CONSTRAINT audit_log_worm_prev_hash_len CHECK (prev_hash IS NULL OR length(prev_hash) <= 128)
);

CREATE TABLE IF NOT EXISTS audit_chain_state (
    tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
    last_seq bigint NOT NULL,
    last_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audit_chain_state_hash_len CHECK (length(last_hash) <= 128)
);

CREATE TABLE IF NOT EXISTS audit_export_runs (
    run_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    from_seq bigint NOT NULL,
    to_seq bigint NOT NULL,
    status text NOT NULL,
    exported_at timestamptz NULL,
    object_key text NULL,
    error_code text NULL,
    error_message_sanitized text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audit_export_runs_status CHECK (status IN ('STARTED', 'SUCCESS', 'FAILED')),
    CONSTRAINT audit_export_runs_obj_key_len CHECK (object_key IS NULL OR length(object_key) <= 512),
    CONSTRAINT audit_export_runs_err_code_len CHECK (error_code IS NULL OR length(error_code) <= 64),
    CONSTRAINT audit_export_runs_err_msg_len CHECK (error_message_sanitized IS NULL OR length(error_message_sanitized) <= 256)
);

CREATE INDEX IF NOT EXISTS audit_log_worm_tenant_ts_idx
    ON audit_log_worm (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS audit_log_worm_tenant_seq_idx
    ON audit_log_worm (tenant_id, seq DESC);

CREATE INDEX IF NOT EXISTS audit_log_worm_correlation_idx
    ON audit_log_worm (correlation_id);

CREATE INDEX IF NOT EXISTS audit_export_runs_tenant_status_idx
    ON audit_export_runs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_export_runs_tenant_range_idx
    ON audit_export_runs (tenant_id, from_seq, to_seq);

CREATE OR REPLACE FUNCTION audit_log_worm_no_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_worm is append-only (WORM)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_worm_block_update ON audit_log_worm;
CREATE TRIGGER audit_log_worm_block_update
BEFORE UPDATE ON audit_log_worm
FOR EACH ROW EXECUTE FUNCTION audit_log_worm_no_update_delete();

DROP TRIGGER IF EXISTS audit_log_worm_block_delete ON audit_log_worm;
CREATE TRIGGER audit_log_worm_block_delete
BEFORE DELETE ON audit_log_worm
FOR EACH ROW EXECUTE FUNCTION audit_log_worm_no_update_delete();
