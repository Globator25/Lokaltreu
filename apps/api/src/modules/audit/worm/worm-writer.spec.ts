import { describe, expect, it } from "vitest";
import { computeWormHash, InMemoryWormAuditWriter } from "./worm-writer.js";

describe("worm audit writer", () => {
  it("computes deterministic hash for the same input", () => {
    const input = {
      tenantId: "tenant-1",
      ts: new Date("2026-01-01T00:00:00.000Z"),
      action: "admin.login",
      result: "SUCCESS",
      deviceId: "device-1",
      cardId: "card-1",
      jti: "jti-1",
      correlationId: "corr-1",
    };
    const hashA = computeWormHash(input, "prev", 1);
    const hashB = computeWormHash(input, "prev", 1);
    expect(hashA).toBe(hashB);
  });

  it("continues the hash chain per tenant", async () => {
    const writer = new InMemoryWormAuditWriter();
    const base = {
      tenantId: "tenant-1",
      ts: new Date("2026-01-01T00:00:00.000Z"),
      action: "stamps.claimed",
      result: "SUCCESS",
      correlationId: "corr-2",
    };

    const first = await writer.write(base);
    const second = await writer.write(base);

    expect(second.seq).toBe(first.seq + 1);
    expect(second.prevHash).toBe(first.hash);
  });
});
