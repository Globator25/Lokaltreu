-- Step 23: DSR Requests (expand-only, no destructive changes).

CREATE TABLE IF NOT EXISTS dsr_requests (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    request_type text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    reason text NULL,
    status text NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(),
    fulfilled_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS dsr_requests_subject_unique
    ON dsr_requests (tenant_id, subject_type, subject_id, request_type);

CREATE INDEX IF NOT EXISTS dsr_requests_status_idx
    ON dsr_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS dsr_requests_subject_idx
    ON dsr_requests (tenant_id, subject_type, subject_id);
