import { describe, expect, it, vi } from "vitest";
import { InMemoryDeletedSubjectsRepository } from "../repositories/deleted-subjects-repo.js";
import { applyTombstonesAfterRestore } from "./dsr-restore.js";

describe("dsr-restore applyTombstonesAfterRestore", () => {
  it("returns zero counts when no tombstones exist", async () => {
    const repo = new InMemoryDeletedSubjectsRepository();
    const applyDeletion = vi.fn(async () => {});

    const result = await applyTombstonesAfterRestore("tenant-a", {
      repo,
      applyDeletion,
    });

    expect(applyDeletion).not.toHaveBeenCalled();
    expect(result).toEqual({ applied: 0, tombstones: 0 });
  });

  it("applies all tombstones and logs info on success", async () => {
    const repo = new InMemoryDeletedSubjectsRepository();
    await repo.insertTombstone({ tenantId: "tenant-a", subjectId: "card-1", reason: "dsr-delete" });
    await repo.insertTombstone({ tenantId: "tenant-a", subjectId: "card-2", reason: "dsr-delete" });

    const applyDeletion = vi.fn(async () => {});
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await applyTombstonesAfterRestore("tenant-a", {
      repo,
      applyDeletion,
      logger,
    });

    expect(applyDeletion).toHaveBeenCalledTimes(2);
    for (const call of applyDeletion.mock.calls) {
      const params = call[0];
      expect(params).toMatchObject({
        tenantId: "tenant-a",
        reason: "dsr-delete",
        subjectId: expect.any(String),
      });
      expect(params.deletedAt).toBeInstanceOf(Date);
      expect(params.correlationId).toEqual(expect.any(String));
    }

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(result.applied).toBe(2);
    expect(result.tombstones).toBe(2);
  });

  it("continues on apply errors, logs warn, and counts only successes", async () => {
    const repo = new InMemoryDeletedSubjectsRepository();
    await repo.insertTombstone({ tenantId: "tenant-a", subjectId: "card-ok", reason: "dsr-delete" });
    await repo.insertTombstone({ tenantId: "tenant-a", subjectId: "card-fail", reason: "dsr-delete" });

    const applyDeletion = vi.fn(async (params: { subjectId: string }) => {
      if (params.subjectId === "card-fail") {
        throw new Error("apply failed");
      }
    });

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await applyTombstonesAfterRestore("tenant-a", {
      repo,
      applyDeletion,
      logger,
    });

    expect(applyDeletion).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ applied: 1, tombstones: 2 });
  });
});
