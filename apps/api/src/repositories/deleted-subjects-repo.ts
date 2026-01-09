export type DeletedSubjectRecord = {
  tenantId: string;
  subjectId: string;
  deletionReason: string;
  deletedAt: Date;
};

export interface DbClientLike {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}

export type DbTransactionLike = DbClientLike;

export interface DeletedSubjectsRepository {
  insertTombstone(
    params: { tenantId: string; subjectId: string; reason: string },
    tx?: DbTransactionLike,
  ): Promise<DeletedSubjectRecord>;
  isTombstoned(
    tenantId: string,
    subjectId: string,
    tx?: DbTransactionLike,
  ): Promise<boolean>;
  listTombstones(
    tenantId: string,
    tx?: DbTransactionLike,
  ): Promise<DeletedSubjectRecord[]>;
}

type DeletedSubjectRow = {
  tenant_id: string;
  subject_id: string;
  deletion_reason: string;
  deleted_at: string | Date;
};

const mapRowToRecord = (row: DeletedSubjectRow): DeletedSubjectRecord => ({
  tenantId: row.tenant_id,
  subjectId: row.subject_id,
  deletionReason: row.deletion_reason,
  deletedAt: new Date(row.deleted_at),
});

const getClient = (db: DbClientLike, tx?: DbTransactionLike): DbClientLike =>
  (tx ?? db);

export class InMemoryDeletedSubjectsRepository implements DeletedSubjectsRepository {
  private readonly byKey = new Map<string, DeletedSubjectRecord>();

  private key(tenantId: string, subjectId: string): string {
    return `${tenantId}:${subjectId}`;
  }

  insertTombstone(
    params: { tenantId: string; subjectId: string; reason: string },
    _tx?: DbTransactionLike,
  ): Promise<DeletedSubjectRecord> {
    void _tx;
    const key = this.key(params.tenantId, params.subjectId);
    const existing = this.byKey.get(key);
    if (existing) {
      return Promise.resolve({ ...existing, deletedAt: new Date(existing.deletedAt) });
    }
    const record: DeletedSubjectRecord = {
      tenantId: params.tenantId,
      subjectId: params.subjectId,
      deletionReason: params.reason,
      deletedAt: new Date(),
    };
    this.byKey.set(key, record);
    return Promise.resolve({ ...record, deletedAt: new Date(record.deletedAt) });
  }

  isTombstoned(
    tenantId: string,
    subjectId: string,
    _tx?: DbTransactionLike,
  ): Promise<boolean> {
    void _tx;
    return Promise.resolve(this.byKey.has(this.key(tenantId, subjectId)));
  }

  listTombstones(
    tenantId: string,
    _tx?: DbTransactionLike,
  ): Promise<DeletedSubjectRecord[]> {
    void _tx;
    const items: DeletedSubjectRecord[] = [];
    for (const record of this.byKey.values()) {
      if (record.tenantId === tenantId) {
        items.push({ ...record, deletedAt: new Date(record.deletedAt) });
      }
    }
    items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    return Promise.resolve(items);
  }
}

export const createDbDeletedSubjectsRepository = (
  db: DbClientLike,
): DeletedSubjectsRepository => ({
  async insertTombstone(params, tx) {
    const client = getClient(db, tx);
    const insert = await client.query<DeletedSubjectRow>(
      `
      INSERT INTO deleted_subjects (
        tenant_id,
        subject_id,
        deletion_reason
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, subject_id) DO NOTHING
      RETURNING tenant_id, subject_id, deletion_reason, deleted_at
      `,
      [params.tenantId, params.subjectId, params.reason],
    );

    if (insert.rowCount > 0) {
      return mapRowToRecord(insert.rows[0]);
    }

    const existing = await client.query<DeletedSubjectRow>(
      `
      SELECT tenant_id, subject_id, deletion_reason, deleted_at
      FROM deleted_subjects
      WHERE tenant_id = $1 AND subject_id = $2
      `,
      [params.tenantId, params.subjectId],
    );

    return mapRowToRecord(existing.rows[0]);
  },

  async isTombstoned(tenantId, subjectId, tx) {
    const client = getClient(db, tx);
    const result = await client.query(
      `
      SELECT 1
      FROM deleted_subjects
      WHERE tenant_id = $1 AND subject_id = $2
      `,
      [tenantId, subjectId],
    );
    return result.rowCount > 0;
  },

  async listTombstones(tenantId, tx) {
    const client = getClient(db, tx);
    const result = await client.query<DeletedSubjectRow>(
      `
      SELECT tenant_id, subject_id, deletion_reason, deleted_at
      FROM deleted_subjects
      WHERE tenant_id = $1
      ORDER BY deleted_at DESC
      `,
      [tenantId],
    );
    return result.rows.map(mapRowToRecord);
  },
});
