-- Step 24: Audit export idempotency (expand-only, no destructive changes).

CREATE UNIQUE INDEX IF NOT EXISTS audit_export_runs_unique_range
    ON audit_export_runs (tenant_id, from_seq, to_seq);
