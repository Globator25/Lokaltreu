import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DbClient = {
  query: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe("jobs/audit-export-worm", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    process.env.AUDIT_EXPORT_S3_BUCKET = "audit-bucket";
    process.env.AUDIT_EXPORT_S3_REGION = "eu-central-1";
    process.env.AUDIT_EXPORT_S3_ACCESS_KEY_ID = "access";
    process.env.AUDIT_EXPORT_S3_SECRET_ACCESS_KEY = "secret";
    process.env.AUDIT_EXPORT_KEY_ID = "key-1";
    process.env.AUDIT_EXPORT_PRIVATE_KEY = Buffer.from(
      "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----",
      "utf8",
    ).toString("base64");
    process.env.AUDIT_EXPORT_PREFIX = "audit";
    process.env.AUDIT_EXPORT_BATCH_SIZE = "25";
    process.env.AUDIT_EXPORT_SCHEMA_VERSION = "1";
    process.env.AUDIT_EXPORT_TENANTS = "tenant-a, tenant-b";
  });

  afterEach(() => {
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
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      close: vi.fn(async () => {}),
    } as DbClient;

    const createS3Client = vi.fn(() => ({ kind: "s3" }));
    const createEd25519Signer = vi.fn(() => ({ kind: "signer" }));
    const runAuditExportJob = vi.fn(async () => {});

    mockDb("../audit-export-worm.js", db);
    vi.doMock("../../modules/audit/export/s3-storage.js", () => ({ createS3Client }));
    vi.doMock("../../modules/audit/export/audit-export.job.js", () => ({
      createEd25519Signer,
      runAuditExportJob,
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => undefined) as any);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../audit-export-worm.js");

    expect(runAuditExportJob).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("error path: exits with 1 and still closes db", async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      close: vi.fn(async () => {}),
    } as DbClient;

    const createS3Client = vi.fn(() => ({ kind: "s3" }));
    const createEd25519Signer = vi.fn(() => ({ kind: "signer" }));
    const runAuditExportJob = vi.fn(async () => {
      throw new Error("boom");
    });

    mockDb("../audit-export-worm.js", db);
    vi.doMock("../../modules/audit/export/s3-storage.js", () => ({ createS3Client }));
    vi.doMock("../../modules/audit/export/audit-export.job.js", () => ({
      createEd25519Signer,
      runAuditExportJob,
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => undefined) as any);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../audit-export-worm.js");

    expect(runAuditExportJob).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
