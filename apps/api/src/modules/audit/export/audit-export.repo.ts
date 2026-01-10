export type AuditExportRunStatus = "STARTED" | "SUCCESS" | "FAILED";

export type AuditWormRow = {
  tenantId: string;
  seq: number;
  ts: Date;
  action: string;
  result: string;
  deviceId: string | null;
  cardId: string | null;
  jti: string | null;
  correlationId: string | null;
  prevHash: string | null;
  hash: string;
};

export type AuditExportRun = {
  runId: string;
  tenantId: string;
  fromSeq: number;
  toSeq: number;
  status: AuditExportRunStatus;
  exportedAt: Date | null;
  objectKey: string | null;
  errorCode: string | null;
  errorMessageSanitized: string | null;
  createdAt: Date;
};

export interface AuditExportRepository {
  listTenants(): Promise<string[]>;
  getMaxSeq(tenantId: string): Promise<number | null>;
  getLastSuccess(tenantId: string): Promise<AuditExportRun | null>;
  getWormEvents(tenantId: string, fromSeq: number, toSeq: number): Promise<AuditWormRow[]>;
  createRun(params: {
    runId: string;
    tenantId: string;
    fromSeq: number;
    toSeq: number;
  }): Promise<AuditExportRun | null>;
  markSuccess(params: {
    runId: string;
    exportedAt: Date;
    objectKey: string;
  }): Promise<void>;
  markFailed(params: {
    runId: string;
    errorCode: string;
    errorMessageSanitized: string;
  }): Promise<void>;
}

export class InMemoryAuditExportRepository implements AuditExportRepository {
  private readonly tenants = new Set<string>();
  private readonly wormEvents: AuditWormRow[] = [];
  private readonly runs = new Map<string, AuditExportRun>();
  private readonly rangeIndex = new Map<string, string>();

  seedWormEvent(event: AuditWormRow): void {
    this.tenants.add(event.tenantId);
    this.wormEvents.push({
      ...event,
      ts: new Date(event.ts),
    });
  }

  listTenants(): Promise<string[]> {
    return Promise.resolve(Array.from(this.tenants.values()));
  }

  getMaxSeq(tenantId: string): Promise<number | null> {
    const seqs = this.wormEvents.filter((row) => row.tenantId === tenantId).map((row) => row.seq);
    if (seqs.length === 0) {
      return Promise.resolve(null);
    }
    return Promise.resolve(Math.max(...seqs));
  }

  getLastSuccess(tenantId: string): Promise<AuditExportRun | null> {
    const runs = Array.from(this.runs.values()).filter(
      (run) => run.tenantId === tenantId && run.status === "SUCCESS",
    );
    if (runs.length === 0) {
      return Promise.resolve(null);
    }
    runs.sort((a, b) => b.toSeq - a.toSeq);
    return Promise.resolve(runs[0] ?? null);
  }

  getWormEvents(tenantId: string, fromSeq: number, toSeq: number): Promise<AuditWormRow[]> {
    const rows = this.wormEvents
      .filter(
        (row) => row.tenantId === tenantId && row.seq >= fromSeq && row.seq <= toSeq,
      )
      .sort((a, b) => a.seq - b.seq)
      .map((row) => ({ ...row, ts: new Date(row.ts) }));
    return Promise.resolve(rows);
  }

  createRun(params: {
    runId: string;
    tenantId: string;
    fromSeq: number;
    toSeq: number;
  }): Promise<AuditExportRun | null> {
    const key = `${params.tenantId}:${params.fromSeq}:${params.toSeq}`;
    if (this.rangeIndex.has(key)) {
      return Promise.resolve(null);
    }
    const run: AuditExportRun = {
      runId: params.runId,
      tenantId: params.tenantId,
      fromSeq: params.fromSeq,
      toSeq: params.toSeq,
      status: "STARTED",
      exportedAt: null,
      objectKey: null,
      errorCode: null,
      errorMessageSanitized: null,
      createdAt: new Date(),
    };
    this.runs.set(run.runId, run);
    this.rangeIndex.set(key, run.runId);
    this.tenants.add(params.tenantId);
    return Promise.resolve(run);
  }

  markSuccess(params: {
    runId: string;
    exportedAt: Date;
    objectKey: string;
  }): Promise<void> {
    const run = this.runs.get(params.runId);
    if (!run) {
      return Promise.resolve();
    }
    run.status = "SUCCESS";
    run.exportedAt = new Date(params.exportedAt);
    run.objectKey = params.objectKey;
    return Promise.resolve();
  }

  markFailed(params: {
    runId: string;
    errorCode: string;
    errorMessageSanitized: string;
  }): Promise<void> {
    const run = this.runs.get(params.runId);
    if (!run) {
      return Promise.resolve();
    }
    run.status = "FAILED";
    run.errorCode = params.errorCode;
    run.errorMessageSanitized = params.errorMessageSanitized;
    return Promise.resolve();
  }
}
