import { describe, expect, it, vi } from "vitest";
import {
  InMemoryWormAuditWriter,
  computeWormHash,
  createDbWormAuditWriter,
  type WormAuditInput,
} from "./worm-writer.js";

type ChainState = { lastSeq: number; lastHash: string };

type DbStub = {
  query: ReturnType<typeof vi.fn>;
  state: Map<string, ChainState>;
  wormRows: Array<{ tenantId: string; seq: number; prevHash: string; hash: string }>;
};

function makeDbStub(): DbStub {
  const state = new Map<string, ChainState>();
  const wormRows: Array<{ tenantId: string; seq: number; prevHash: string; hash: string }> = [];

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("INSERT INTO audit_chain_state")) {
      const tenantId = String(params?.[0] ?? "");
      if (!state.has(tenantId)) {
        state.set(tenantId, { lastSeq: 0, lastHash: "" });
      }
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("SELECT last_seq, last_hash") && sql.includes("FOR UPDATE")) {
      const tenantId = String(params?.[0] ?? "");
      const current = state.get(tenantId);
      if (!current) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{ last_seq: current.lastSeq, last_hash: current.lastHash }],
        rowCount: 1,
      };
    }

    if (sql.includes("INSERT INTO audit_log_worm")) {
      const tenantId = String(params?.[0] ?? "");
      const seq = Number(params?.[1] ?? 0);
      const prevHash = String(params?.[9] ?? "");
      const hash = String(params?.[10] ?? "");
      wormRows.push({ tenantId, seq, prevHash, hash });
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("UPDATE audit_chain_state")) {
      const tenantId = String(params?.[0] ?? "");
      const lastSeq = Number(params?.[1] ?? 0);
      const lastHash = String(params?.[2] ?? "");
      state.set(tenantId, { lastSeq, lastHash });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });

  return { query, state, wormRows };
}

function baseInput(overrides?: Partial<WormAuditInput>): WormAuditInput {
  return {
    tenantId: "tenant-1",
    ts: new Date("2026-01-01T00:00:00.000Z"),
    action: "admin.login",
    result: "SUCCESS",
    correlationId: "corr-1",
    ...overrides,
  };
}

describe("worm audit writer", () => {
  it("computes deterministic hash for the same input", () => {
    const input = baseInput({ deviceId: "device-1", cardId: "card-1", jti: "jti-1" });
    const hashA = computeWormHash(input, "prev", 1);
    const hashB = computeWormHash(input, "prev", 1);
    expect(hashA).toBe(hashB);
  });

  it("hash changes when sequence or previous hash changes", () => {
    const input = baseInput();
    const hashSeq1 = computeWormHash(input, "prev", 1);
    const hashSeq2 = computeWormHash(input, "prev", 2);
    const hashPrev = computeWormHash(input, "other-prev", 1);

    expect(hashSeq2).not.toBe(hashSeq1);
    expect(hashPrev).not.toBe(hashSeq1);
  });

  it("in-memory writer starts a new tenant chain with empty prevHash", async () => {
    const writer = new InMemoryWormAuditWriter();

    const first = await writer.write(baseInput({ tenantId: "tenant-new" }));

    expect(first.seq).toBe(1);
    expect(first.prevHash).toBe("");
    expect(first.hash).toEqual(expect.any(String));
  });

  it("continues the hash chain per tenant in memory", async () => {
    const writer = new InMemoryWormAuditWriter();

    const first = await writer.write(baseInput());
    const second = await writer.write(baseInput());

    expect(second.seq).toBe(first.seq + 1);
    expect(second.prevHash).toBe(first.hash);
  });

  it("db writer writes multiple rows, advances chain, and logs", async () => {
    const db = makeDbStub();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const transaction = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const writer = createDbWormAuditWriter({ db: { query: db.query }, transaction, logger });

    const first = await writer.write(baseInput({ tenantId: "tenant-a", correlationId: "corr-a" }));
    const second = await writer.write(baseInput({ tenantId: "tenant-a", correlationId: "corr-b" }));

    expect(transaction.run).toHaveBeenCalledTimes(2);
    expect(db.wormRows).toHaveLength(2);
    expect(first.seq).toBe(1);
    expect(first.prevHash).toBe("");
    expect(second.seq).toBe(2);
    expect(second.prevHash).toBe(first.hash);
    expect(db.state.get("tenant-a")).toMatchObject({ lastSeq: 2, lastHash: second.hash });
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it("db writer stores nullable fields as null in INSERT params", async () => {
    const db = makeDbStub();
    const transaction = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const writer = createDbWormAuditWriter({ db: { query: db.query }, transaction });

    await writer.write(
      baseInput({
        tenantId: "tenant-null",
        deviceId: undefined,
        cardId: undefined,
        jti: undefined,
        correlationId: undefined,
      }),
    );

    const insertCall = db.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log_worm"));
    const params = insertCall?.[1] as unknown[] | undefined;

    expect(params?.[5]).toBeNull();
    expect(params?.[6]).toBeNull();
    expect(params?.[7]).toBeNull();
    expect(params?.[8]).toBeNull();
  });

  it("db writer throws on missing tenantId before touching the db", async () => {
    const db = makeDbStub();
    const transaction = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const writer = createDbWormAuditWriter({ db: { query: db.query }, transaction });

    expect(() => writer.write(baseInput({ tenantId: "" }))).toThrow(
      "audit_log_worm requires tenantId",
    );

    expect(transaction.run).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it("db writer surfaces errors when chain state cannot be loaded", async () => {
    const db = makeDbStub();
    const transaction = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const writer = createDbWormAuditWriter({ db: { query: db.query }, transaction });

    db.query.mockImplementationOnce(async () => ({ rows: [], rowCount: 1 }));
    db.query.mockImplementationOnce(async () => ({ rows: [], rowCount: 0 }));

    await expect(writer.write(baseInput({ tenantId: "tenant-missing" }))).rejects.toThrowError(
      "audit_chain_state missing",
    );
  });

  it("db writer does not swallow sink errors during INSERT", async () => {
    const db = makeDbStub();
    const transaction = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const writer = createDbWormAuditWriter({ db: { query: db.query }, transaction });

    const originalImpl = db.query.getMockImplementation();
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("INSERT INTO audit_log_worm")) {
        throw new Error("insert failed");
      }
      return originalImpl ? originalImpl(sql, params) : { rows: [], rowCount: 0 };
    });

    await expect(writer.write(baseInput({ tenantId: "tenant-error" }))).rejects.toThrowError(
      "insert failed",
    );
  });
});
