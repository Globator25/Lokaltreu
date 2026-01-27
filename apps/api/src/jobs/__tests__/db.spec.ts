import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn(async () => {});
const mockQuery = vi.fn(async () => ({ rows: [{ value: 1 }], rowCount: 1 }));
const mockEnd = vi.fn(async () => {});

const mockClientCtor = vi.fn(() => ({
  connect: mockConnect,
  query: mockQuery,
  end: mockEnd,
}));

vi.mock("pg", () => ({
  Client: mockClientCtor,
}));

describe("jobs/db", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const mod = await import("../db.js");

    await expect(mod.createJobDbClient()).rejects.toThrowError("DATABASE_URL is required");
    expect(mockClientCtor).not.toHaveBeenCalled();
  });

  it("connects with DATABASE_URL and exposes query/close wrappers", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const mod = await import("../db.js");

    const client = await mod.createJobDbClient();

    expect(mockClientCtor).toHaveBeenCalledWith({ connectionString: "postgres://example" });
    expect(mockConnect).toHaveBeenCalledTimes(1);

    const result = await client.query<{ value: number }>("SELECT 1", ["a"]);
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1", ["a"]);
    expect(result).toEqual({ rows: [{ value: 1 }] });

    await client.close();
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
