import { describe, expect, it, vi } from "vitest";
import { pruneAuditLogWorm } from "../../src/modules/audit/retention/audit-retention.js";

describe("audit retention", () => {
  it("deletes rows older than retention window", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 42 });
    const now = new Date("2026-02-01T00:00:00.000Z");
    const result = await pruneAuditLogWorm({
      db: { query },
      now: () => now,
      retentionDays: 180,
      logger: { warn: vi.fn() },
    });

    expect(result.deletedCount).toBe(42);
    expect(query).toHaveBeenCalledTimes(1);
    const params = query.mock.calls[0]?.[1] as [Date];
    expect(params[0]).toBeInstanceOf(Date);
    expect(params[0].toISOString()).toBe("2025-08-05T00:00:00.000Z");
  });
});
