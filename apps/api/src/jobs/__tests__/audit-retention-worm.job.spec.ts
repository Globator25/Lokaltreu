import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DbClient = {
  query: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe("jobs/audit-retention-worm", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-27T00:00:00.000Z"));
    process.env = { ...originalEnv };
    delete process.env.AUDIT_RETENTION_DAYS;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  function mockDb(jobModulePath: string, db: DbClient) {
    const jobUrl = new URL(jobModulePath, import.meta.url);
    const dbUrlJs = new URL("./db.js", jobUrl).pathname;
    const dbUrlTs = new URL("./db.ts", jobUrl).pathname;
    const factory = () => ({ createJobDbClient: vi.fn(async () => db) });
    vi.doMock(dbUrlJs, factory);
    vi.doMock(dbUrlTs, factory);
  }

  it("success path: does not exit and closes db", async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [{ deleted_count: "7" }], rowCount: 1 })),
      close: vi.fn(async () => {}),
    } as DbClient;

    mockDb("../audit-retention-worm.js", db);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => undefined) as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../audit-retention-worm.js");

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("audit retention pruned", {
      deleted_count: 7,
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("error path: exits with 1 and still closes db", async () => {
    const db = {
      query: vi.fn(async () => {
        throw new Error("db down");
      }),
      close: vi.fn(async () => {}),
    } as DbClient;

    mockDb("../audit-retention-worm.js", db);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => undefined) as any);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../audit-retention-worm.js");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
