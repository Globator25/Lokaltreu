import crypto from "node:crypto";
import type { DbClientLike } from "../../../repositories/referrals.repo.js";

export type WormAuditInput = {
  tenantId: string;
  ts: Date;
  action: string;
  result: string;
  deviceId?: string;
  cardId?: string;
  jti?: string;
  correlationId?: string;
};

export type WormAuditWriteResult = {
  seq: number;
  prevHash: string;
  hash: string;
};

export type WormAuditWriter = {
  write: (input: WormAuditInput) => Promise<WormAuditWriteResult>;
};

export type WormAuditWriterDeps = {
  db: DbClientLike;
  transaction: { run: <T>(fn: () => Promise<T>) => Promise<T> };
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return "null";
}

function buildCanonicalRecord(input: WormAuditInput): Record<string, unknown> {
  return {
    tenant_id: input.tenantId,
    ts: input.ts.toISOString(),
    action: input.action,
    result: input.result,
    device_id: input.deviceId,
    card_id: input.cardId,
    jti: input.jti,
    correlation_id: input.correlationId,
  };
}

export function computeWormHash(
  input: WormAuditInput,
  prevHash: string,
  seq: number,
): string {
  const canonical = canonicalJson(buildCanonicalRecord(input));
  const payload = `${canonical}${prevHash}${seq}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

export function createDbWormAuditWriter(deps: WormAuditWriterDeps): WormAuditWriter {
  return {
    write(input) {
      if (!input.tenantId) {
        throw new Error("audit_log_worm requires tenantId");
      }
      return deps.transaction.run(async () => {
        await deps.db.query(
          `
          INSERT INTO audit_chain_state (tenant_id, last_seq, last_hash)
          VALUES ($1, 0, '')
          ON CONFLICT (tenant_id) DO NOTHING
          `,
          [input.tenantId],
        );

        const state = await deps.db.query<{ last_seq: number; last_hash: string }>(
          `
          SELECT last_seq, last_hash
          FROM audit_chain_state
          WHERE tenant_id = $1
          FOR UPDATE
          `,
          [input.tenantId],
        );
        if (state.rowCount === 0) {
          throw new Error("audit_chain_state missing");
        }
        const lastSeq = Number(state.rows[0]?.last_seq ?? 0);
        const lastHash = state.rows[0]?.last_hash ?? "";
        const nextSeq = lastSeq + 1;
        const hash = computeWormHash(input, lastHash, nextSeq);

        await deps.db.query(
          `
          INSERT INTO audit_log_worm (
            tenant_id,
            seq,
            ts,
            action,
            result,
            device_id,
            card_id,
            jti,
            correlation_id,
            prev_hash,
            hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
          [
            input.tenantId,
            nextSeq,
            input.ts,
            input.action,
            input.result,
            input.deviceId ?? null,
            input.cardId ?? null,
            input.jti ?? null,
            input.correlationId ?? null,
            lastHash,
            hash,
          ],
        );

        await deps.db.query(
          `
          UPDATE audit_chain_state
          SET last_seq = $2, last_hash = $3, updated_at = now()
          WHERE tenant_id = $1
          `,
          [input.tenantId, nextSeq, hash],
        );

        deps.logger?.info?.("audit worm write", {
          tenant_id: input.tenantId,
          seq: nextSeq,
          correlation_id: input.correlationId,
        });

        return { seq: nextSeq, prevHash: lastHash, hash };
      });
    },
  };
}

export class InMemoryWormAuditWriter implements WormAuditWriter {
  private readonly states = new Map<string, { lastSeq: number; lastHash: string }>();

  write(input: WormAuditInput): Promise<WormAuditWriteResult> {
    const existing = this.states.get(input.tenantId) ?? { lastSeq: 0, lastHash: "" };
    const nextSeq = existing.lastSeq + 1;
    const hash = computeWormHash(input, existing.lastHash, nextSeq);
    this.states.set(input.tenantId, { lastSeq: nextSeq, lastHash: hash });
    return Promise.resolve({ seq: nextSeq, prevHash: existing.lastHash, hash });
  }
}
