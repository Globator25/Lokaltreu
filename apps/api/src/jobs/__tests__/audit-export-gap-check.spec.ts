import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.fn();
const mockDbClose = vi.fn();
const mockCreateJobDbClient = vi.fn(async () => ({
  query: mockDbQuery,
  close: mockDbClose,
}));

const mockCheckAuditExportGaps = vi.fn();

class MockInMemoryAuditGapCounter {
  value = 0;
  inc(amount = 1) {
    this.value += amount;
  }
}

vi.mock("../db.js", () => ({
  createJobDbClient: mockCreateJobDbClient,
}));

vi.mock("../../modules/audit/export/audit-export.monitor.js", () => ({
  InMemoryAuditGapCounter: MockInMemoryAuditGapCounter,
  checkAuditExportGaps: mockCheckAuditExportGaps,
}));

describe("jobs/audit-export-gap-check", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AUDIT_EXPORT_TENANTS;
    delete process.env.AUDIT_EXPORT_GAP_MINUTES;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parseTenantFilter trims, filters, and returns undefined for empty input", async () => {
    const mod = await import("../audit-export-gap-check.js");

    expect(mod.parseTenantFilter(undefined)).toBeUndefined();
    expect(mod.parseTenantFilter("")).toBeUndefined();
    expect(mod.parseTenantFilter(" ,  ")).toBeUndefined();
    expect(mod.parseTenantFilter(" tenant-a, tenant-b , ,tenant-c ")).toEqual([
      "tenant-a",
      "tenant-b",
      "tenant-c",
    ]);
  });

  it("exitCodeForGapEvents returns 0 when no gaps and 2 when gaps exist", async () => {
    const mod = await import("../audit-export-gap-check.js");

    expect(mod.exitCodeForGapEvents(0)).toBe(0);
    expect(mod.exitCodeForGapEvents(1)).toBe(2);
    expect(mod.exitCodeForGapEvents(99)).toBe(2);
  });

  it("runGapCheck uses tenant filter and sets exitCode=0 without gap events", async () => {
    process.env.AUDIT_EXPORT_TENANTS = "tenant-filtered";
    process.env.AUDIT_EXPORT_GAP_MINUTES = "15";

    mockCheckAuditExportGaps.mockImplementationOnce(async ({ repo, gapMinutes, counter }) => {
      const tenants = await repo.listTenants();
      // Exercise repo helpers and DB mappings without network/FS.
      for (const tenantId of tenants) {
        await repo.getMaxSeq(tenantId);
        await repo.getLastSuccess(tenantId);
      }
      counter.value = 0;
      return {
        gapEvents: 0,
        worstGapSeconds: 0,
        tenantsChecked: tenants.length,
        gapMinutes,
      };
    });

    mockDbQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT DISTINCT tenant_id FROM audit_log_worm")) {
        return { rows: [{ tenant_id: "tenant-from-db" }], rowCount: 1 };
      }
      if (sql.includes("SELECT MAX(seq) AS max_seq")) {
        expect(params).toEqual(["tenant-filtered"]);
        return { rows: [{ max_seq: "42" }], rowCount: 1 };
      }
      if (sql.includes("FROM audit_export_runs") && sql.includes("status = 'SUCCESS'")) {
        expect(params).toEqual(["tenant-filtered"]);
        return {
          rows: [
            {
              run_id: "run-1",
              tenant_id: "tenant-filtered",
              from_seq: "1",
              to_seq: "42",
              status: "SUCCESS",
              exported_at: "2026-01-01T00:00:00.000Z",
              object_key: "audit/key",
              error_code: null,
              error_message_sanitized: null,
              created_at: "2026-01-01T00:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../audit-export-gap-check.js");
    await mod.runGapCheck();

    expect(mockCreateJobDbClient).toHaveBeenCalledTimes(1);
    expect(mockCheckAuditExportGaps).toHaveBeenCalledTimes(1);
    expect(mockCheckAuditExportGaps.mock.calls[0]?.[0]?.gapMinutes).toBe(15);
    expect(process.exitCode).toBe(0);
    expect(mockDbClose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("runGapCheck sets exitCode=2 when gaps are detected", async () => {
    process.env.AUDIT_EXPORT_TENANTS = "tenant-a,tenant-b";

    mockCheckAuditExportGaps.mockImplementationOnce(async ({ repo, counter }) => {
      const tenants = await repo.listTenants();
      for (const tenantId of tenants) {
        await repo.getMaxSeq(tenantId);
        await repo.getLastSuccess(tenantId);
      }
      counter.value = 9;
      return {
        gapEvents: 3,
        worstGapSeconds: 120,
        tenantsChecked: tenants.length,
      };
    });

    mockDbQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT MAX(seq) AS max_seq")) {
        const tenantId = params?.[0];
        return { rows: [{ max_seq: tenantId === "tenant-a" ? "10" : "12" }], rowCount: 1 };
      }
      if (sql.includes("FROM audit_export_runs") && sql.includes("status = 'SUCCESS'")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../audit-export-gap-check.js");
    await mod.runGapCheck();

    expect(mockCheckAuditExportGaps).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(2);
    expect(mockDbClose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });
});
