-- Step 23: DSR Tombstones (expand-only, no destructive changes).

CREATE TABLE IF NOT EXISTS deleted_subjects (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    subject_id text NOT NULL,
    deletion_reason text NOT NULL,
    deleted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, subject_id)
);

CREATE INDEX IF NOT EXISTS deleted_subjects_tenant_subject_idx
    ON deleted_subjects (tenant_id, subject_id);

CREATE INDEX IF NOT EXISTS deleted_subjects_deleted_at_idx
    ON deleted_subjects (deleted_at DESC);
