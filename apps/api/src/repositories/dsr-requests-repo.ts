import type { components } from "@lokaltreu/types";

type DsrRequestCreateRequest = components["schemas"]["DsrRequestCreateRequest"];
type DsrRequestResponse = components["schemas"]["DsrRequestResponse"];
type DsrSubject = components["schemas"]["DsrSubject"];

export type DsrRequestStatus = DsrRequestResponse["status"];
export type DsrRequestType = DsrRequestCreateRequest["requestType"];
export type DsrSubjectType = DsrSubject["subject_type"];

export type DsrRequestRecord = {
  id: string;
  tenantId: string;
  requestType: DsrRequestType;
  subjectType: DsrSubjectType;
  subjectId: string;
  reason: string | null;
  status: DsrRequestStatus;
  createdAt: Date;
  fulfilledAt: Date | null;
};

export interface DbClientLike {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}

export type DbTransactionLike = DbClientLike;

export interface DsrRequestRepository {
  createRequest(
    params: {
      id: string;
      tenantId: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      reason: string | null;
      status: DsrRequestStatus;
      createdAt: Date;
    },
    tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord>;
  findById(
    tenantId: string,
    dsrRequestId: string,
    tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord | null>;
  markFulfilled(
    params: { tenantId: string; dsrRequestId: string; fulfilledAt: Date },
    tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord | null>;
}

type DsrRequestRow = {
  id: string;
  tenant_id: string;
  request_type: string;
  subject_type: string;
  subject_id: string;
  reason: string | null;
  status: string;
  created_at: string | Date;
  fulfilled_at: string | Date | null;
};

const mapRow = (row: DsrRequestRow): DsrRequestRecord => ({
  id: row.id,
  tenantId: row.tenant_id,
  requestType: row.request_type as DsrRequestType,
  subjectType: row.subject_type as DsrSubjectType,
  subjectId: row.subject_id,
  reason: row.reason,
  status: row.status as DsrRequestStatus,
  createdAt: new Date(row.created_at),
  fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at) : null,
});

const getClient = (db: DbClientLike, tx?: DbTransactionLike): DbClientLike => (tx ?? db);

export class InMemoryDsrRequestRepository implements DsrRequestRepository {
  private readonly byId = new Map<string, DsrRequestRecord>();
  private readonly bySubject = new Map<string, string>();

  private subjectKey(params: {
    tenantId: string;
    subjectType: DsrSubjectType;
    subjectId: string;
    requestType: DsrRequestType;
  }): string {
    return `${params.tenantId}:${params.subjectType}:${params.subjectId}:${params.requestType}`;
  }

  createRequest(
    params: {
      id: string;
      tenantId: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      reason: string | null;
      status: DsrRequestStatus;
      createdAt: Date;
    },
    _tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord> {
    void _tx;
    const key = this.subjectKey(params);
    const existingId = this.bySubject.get(key);
    if (existingId) {
      const existing = this.byId.get(existingId);
      if (existing) {
        return Promise.resolve({
          ...existing,
          createdAt: new Date(existing.createdAt),
          fulfilledAt: existing.fulfilledAt ? new Date(existing.fulfilledAt) : null,
        });
      }
    }
    const record: DsrRequestRecord = {
      id: params.id,
      tenantId: params.tenantId,
      requestType: params.requestType,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      reason: params.reason,
      status: params.status,
      createdAt: new Date(params.createdAt),
      fulfilledAt: null,
    };
    this.byId.set(record.id, record);
    this.bySubject.set(key, record.id);
    return Promise.resolve({
      ...record,
      createdAt: new Date(record.createdAt),
      fulfilledAt: null,
    });
  }

  findById(
    tenantId: string,
    dsrRequestId: string,
    _tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord | null> {
    void _tx;
    const record = this.byId.get(dsrRequestId);
    if (!record || record.tenantId !== tenantId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      ...record,
      createdAt: new Date(record.createdAt),
      fulfilledAt: record.fulfilledAt ? new Date(record.fulfilledAt) : null,
    });
  }

  markFulfilled(
    params: { tenantId: string; dsrRequestId: string; fulfilledAt: Date },
    _tx?: DbTransactionLike,
  ): Promise<DsrRequestRecord | null> {
    void _tx;
    const record = this.byId.get(params.dsrRequestId);
    if (!record || record.tenantId !== params.tenantId || record.status !== "PENDING") {
      return Promise.resolve(null);
    }
    record.status = "FULFILLED";
    record.fulfilledAt = new Date(params.fulfilledAt);
    return Promise.resolve({
      ...record,
      createdAt: new Date(record.createdAt),
      fulfilledAt: record.fulfilledAt ? new Date(record.fulfilledAt) : null,
    });
  }
}

export const createDbDsrRequestRepository = (db: DbClientLike): DsrRequestRepository => ({
  async createRequest(params, tx) {
    const client = getClient(db, tx);
    const insert = await client.query<DsrRequestRow>(
      `
      INSERT INTO dsr_requests (
        id,
        tenant_id,
        request_type,
        subject_type,
        subject_id,
        reason,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, subject_type, subject_id, request_type) DO NOTHING
      RETURNING
        id,
        tenant_id,
        request_type,
        subject_type,
        subject_id,
        reason,
        status,
        created_at,
        fulfilled_at
      `,
      [
        params.id,
        params.tenantId,
        params.requestType,
        params.subjectType,
        params.subjectId,
        params.reason,
        params.status,
        params.createdAt,
      ],
    );
    if (insert.rowCount > 0) {
      return mapRow(insert.rows[0]);
    }

    const existing = await client.query<DsrRequestRow>(
      `
      SELECT
        id,
        tenant_id,
        request_type,
        subject_type,
        subject_id,
        reason,
        status,
        created_at,
        fulfilled_at
      FROM dsr_requests
      WHERE tenant_id = $1 AND subject_type = $2 AND subject_id = $3 AND request_type = $4
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [params.tenantId, params.subjectType, params.subjectId, params.requestType],
    );
    if (existing.rowCount === 0) {
      throw new Error("DSR request missing after conflict");
    }
    return mapRow(existing.rows[0]);
  },

  async findById(tenantId, dsrRequestId, tx) {
    const client = getClient(db, tx);
    const result = await client.query<DsrRequestRow>(
      `
      SELECT
        id,
        tenant_id,
        request_type,
        subject_type,
        subject_id,
        reason,
        status,
        created_at,
        fulfilled_at
      FROM dsr_requests
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, dsrRequestId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  },

  async markFulfilled(params, tx) {
    const client = getClient(db, tx);
    const result = await client.query<DsrRequestRow>(
      `
      UPDATE dsr_requests
      SET status = 'FULFILLED', fulfilled_at = $3
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING
        id,
        tenant_id,
        request_type,
        subject_type,
        subject_id,
        reason,
        status,
        created_at,
        fulfilled_at
      `,
      [params.tenantId, params.dsrRequestId, params.fulfilledAt],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  },
});
