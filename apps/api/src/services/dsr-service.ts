import { randomUUID } from "node:crypto";
import type {
  DeletedSubjectsRepository,
} from "../repositories/deleted-subjects-repo.js";
import type {
  DsrRequestRecord,
  DsrRequestRepository,
  DsrRequestType,
  DsrSubjectType,
} from "../repositories/dsr-requests-repo.js";

export type DsrFulfillAction = "DELETE" | "PSEUDONYMIZE";

export class DsrRequestNotFoundError extends Error {
  constructor(message = "DSR request not found") {
    super(message);
    this.name = "DsrRequestNotFoundError";
  }
}

export class DsrRequestAlreadyFulfilledError extends Error {
  constructor(message = "DSR request already fulfilled") {
    super(message);
    this.name = "DsrRequestAlreadyFulfilledError";
  }
}

export class DsrRequestInvalidActionError extends Error {
  constructor(message = "Invalid DSR fulfill action") {
    super(message);
    this.name = "DsrRequestInvalidActionError";
  }
}

export type DsrApplyDeletionParams = {
  tenantId: string;
  subjectType: DsrSubjectType;
  subjectId: string;
  requestType: DsrRequestType;
  action: DsrFulfillAction;
  correlationId: string;
};

export type DsrServiceDeps = {
  repo: DsrRequestRepository;
  tombstoneRepo: DeletedSubjectsRepository;
  transaction: { run: <T>(fn: () => Promise<T>) => Promise<T> };
  applyDeletion: (params: DsrApplyDeletionParams) => Promise<void>;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  now?: () => Date;
};

function resolveFulfillAction(
  requestType: DsrRequestType,
  action: DsrFulfillAction | null,
): DsrFulfillAction {
  const fallback = requestType === "ERASURE" ? "PSEUDONYMIZE" : "DELETE";
  if (!action) {
    return fallback;
  }
  if (requestType === "DELETE" && action !== "DELETE") {
    throw new DsrRequestInvalidActionError("Invalid action for DELETE request");
  }
  return action;
}

function resolveDeletionReason(record: DsrRequestRecord): string {
  const trimmed = record.reason?.trim();
  if (trimmed) {
    return trimmed;
  }
  return record.requestType;
}

export function createDsrService(deps: DsrServiceDeps) {
  const now = deps.now ?? (() => new Date());

  return {
    async createDsrRequest(params: {
      tenantId: string;
      requestType: DsrRequestType;
      subjectType: DsrSubjectType;
      subjectId: string;
      reason: string | null;
    }): Promise<DsrRequestRecord> {
      const record = await deps.repo.createRequest({
        id: randomUUID(),
        tenantId: params.tenantId,
        requestType: params.requestType,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        reason: params.reason,
        status: "PENDING",
        createdAt: now(),
      });
      deps.logger?.info?.("dsr request created", {
        tenant_id: record.tenantId,
        subject_id: record.subjectId,
      });
      return record;
    },

    async getDsrRequest(params: {
      tenantId: string;
      dsrRequestId: string;
    }): Promise<DsrRequestRecord> {
      const record = await deps.repo.findById(params.tenantId, params.dsrRequestId);
      if (!record) {
        throw new DsrRequestNotFoundError();
      }
      return record;
    },

    async fulfillDsrRequest(params: {
      tenantId: string;
      dsrRequestId: string;
      action: DsrFulfillAction | null;
      correlationId?: string;
    }): Promise<DsrRequestRecord> {
      const record = await deps.repo.findById(params.tenantId, params.dsrRequestId);
      if (!record) {
        throw new DsrRequestNotFoundError();
      }
      if (record.status !== "PENDING") {
        throw new DsrRequestAlreadyFulfilledError();
      }
      const action = resolveFulfillAction(record.requestType, params.action);
      const correlationId = params.correlationId ?? randomUUID();
      const fulfilledAt = now();

      return deps.transaction.run(async () => {
        await deps.applyDeletion({
          tenantId: record.tenantId,
          subjectType: record.subjectType,
          subjectId: record.subjectId,
          requestType: record.requestType,
          action,
          correlationId,
        });

        await deps.tombstoneRepo.insertTombstone({
          tenantId: record.tenantId,
          subjectId: record.subjectId,
          reason: resolveDeletionReason(record),
        });

        const updated = await deps.repo.markFulfilled({
          tenantId: record.tenantId,
          dsrRequestId: record.id,
          fulfilledAt,
        });

        if (!updated) {
          const latest = await deps.repo.findById(record.tenantId, record.id);
          if (!latest) {
            throw new DsrRequestNotFoundError();
          }
          if (latest.status !== "PENDING") {
            throw new DsrRequestAlreadyFulfilledError();
          }
          throw new Error("Failed to update DSR status");
        }

        deps.logger?.info?.("dsr request fulfilled", {
          tenant_id: record.tenantId,
          subject_id: record.subjectId,
          correlation_id: correlationId,
        });

        return updated;
      });
    },
  };
}
