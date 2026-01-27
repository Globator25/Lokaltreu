import { describe, expect, it, vi } from "vitest";
import { createDbAuditExportRepository } from "../../src/modules/audit/export/audit-export.db.js";
import type { DbClientLike } from "../../src/repositories/referrals.repo.js";

describe("audit-export.db repository", () => {
  it("listTenants returns distinct tenant ids", async () => {
    const query = vi.fn(async () => ({ rows: [{ tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }], rowCount: 2 }));
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    const tenants = await repo.listTenants();

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("SELECT DISTINCT tenant_id FROM audit_log_worm");
    expect(tenants).toEqual(["tenant-a", "tenant-b"]);
  });

  it("getMaxSeq returns null on empty result or null max_seq", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ max_seq: null }], rowCount: 1 });
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    await expect(repo.getMaxSeq("tenant-a")).resolves.toBeNull();
    await expect(repo.getMaxSeq("tenant-a")).resolves.toBeNull();
  });

  it("getMaxSeq converts string max_seq to number", async () => {
    const query = vi.fn(async () => ({ rows: [{ max_seq: "42" }], rowCount: 1 }));
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    const maxSeq = await repo.getMaxSeq("tenant-a");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT MAX(seq) AS max_seq"), ["tenant-a"]);
    expect(maxSeq).toBe(42);
  });

  it("getLastSuccess returns null when no rows and maps run fields when present", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            run_id: "run-1",
            tenant_id: "tenant-a",
            from_seq: "1",
            to_seq: "5",
            status: "SUCCESS",
            exported_at: "2026-01-01T00:00:00.000Z",
            object_key: "audit/key",
            error_code: null,
            error_message_sanitized: null,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        rowCount: 1,
      });
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    await expect(repo.getLastSuccess("tenant-a")).resolves.toBeNull();

    const run = await repo.getLastSuccess("tenant-a");
    expect(run).toMatchObject({
      runId: "run-1",
      tenantId: "tenant-a",
      fromSeq: 1,
      toSeq: 5,
      status: "SUCCESS",
      objectKey: "audit/key",
      errorCode: null,
      errorMessageSanitized: null,
    });
    expect(run?.exportedAt).toBeInstanceOf(Date);
    expect(run?.createdAt).toBeInstanceOf(Date);
  });

  it("getWormEvents maps db rows into domain rows", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          tenant_id: "tenant-a",
          seq: "7",
          ts: "2026-01-02T00:00:00.000Z",
          action: "stamp.claimed",
          result: "SUCCESS",
          device_id: "device-1",
          card_id: "card-1",
          jti: "jti-1",
          correlation_id: "corr-1",
          prev_hash: "prev",
          hash: "hash",
        },
      ],
      rowCount: 1,
    }));
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    const events = await repo.getWormEvents("tenant-a", 1, 7);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM audit_log_worm"), [
      "tenant-a",
      1,
      7,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenantId: "tenant-a",
      seq: 7,
      action: "stamp.claimed",
      result: "SUCCESS",
      deviceId: "device-1",
      cardId: "card-1",
      jti: "jti-1",
      correlationId: "corr-1",
      prevHash: "prev",
      hash: "hash",
    });
    expect(events[0]?.ts).toBeInstanceOf(Date);
  });

  it("createRun returns null on conflict and maps created runs", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            run_id: "run-2",
            tenant_id: "tenant-a",
            from_seq: "6",
            to_seq: "10",
            status: "STARTED",
            exported_at: null,
            object_key: null,
            error_code: null,
            error_message_sanitized: null,
            created_at: "2026-01-03T00:00:00.000Z",
          },
        ],
        rowCount: 1,
      });
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    await expect(
      repo.createRun({ runId: "run-2", tenantId: "tenant-a", fromSeq: 6, toSeq: 10 }),
    ).resolves.toBeNull();

    const run = await repo.createRun({ runId: "run-2", tenantId: "tenant-a", fromSeq: 6, toSeq: 10 });

    expect(run).toMatchObject({
      runId: "run-2",
      tenantId: "tenant-a",
      fromSeq: 6,
      toSeq: 10,
      status: "STARTED",
    });
    expect(run?.createdAt).toBeInstanceOf(Date);
  });

  it("markSuccess and markFailed forward parameters to SQL", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const repo = createDbAuditExportRepository({ query } as unknown as DbClientLike);

    const exportedAt = new Date("2026-01-04T00:00:00.000Z");
    await repo.markSuccess({ runId: "run-1", exportedAt, objectKey: "audit/object" });
    await repo.markFailed({ runId: "run-2", errorCode: "EXPORT_FAILED", errorMessageSanitized: "failed" });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("SET status = 'SUCCESS'");
    expect(query.mock.calls[0]?.[1]).toEqual(["run-1", exportedAt, "audit/object"]);

    expect(query.mock.calls[1]?.[0]).toContain("SET status = 'FAILED'");
    expect(query.mock.calls[1]?.[1]).toEqual(["run-2", "EXPORT_FAILED", "failed"]);
  });
});
