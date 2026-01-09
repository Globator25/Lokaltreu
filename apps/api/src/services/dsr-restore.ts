import { randomUUID } from "node:crypto";
import type { DeletedSubjectsRepository } from "../repositories/deleted-subjects-repo.js";

export type DsrRestoreApplyFn = (params: {
  tenantId: string;
  subjectId: string;
  reason: string;
  deletedAt: Date;
  correlationId: string;
}) => Promise<void>;

export type DsrRestoreDeps = {
  repo: DeletedSubjectsRepository;
  applyDeletion: DsrRestoreApplyFn;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

export async function applyTombstonesAfterRestore(
  tenantId: string,
  deps: DsrRestoreDeps,
): Promise<{ applied: number; tombstones: number }> {
  const tombstones = await deps.repo.listTombstones(tenantId);
  let applied = 0;

  for (const tombstone of tombstones) {
    const correlationId = randomUUID();
    try {
      await deps.applyDeletion({
        tenantId,
        subjectId: tombstone.subjectId,
        reason: tombstone.deletionReason,
        deletedAt: tombstone.deletedAt,
        correlationId,
      });
      applied += 1;
      deps.logger?.info?.("dsr restore apply tombstone", {
        tenant_id: tenantId,
        subject_id: tombstone.subjectId,
        correlation_id: correlationId,
      });
    } catch (error) {
      deps.logger?.warn?.("dsr restore apply tombstone failed", {
        tenant_id: tenantId,
        subject_id: tombstone.subjectId,
        correlation_id: correlationId,
        error: String(error),
      });
    }
  }

  return { applied, tombstones: tombstones.length };
}
