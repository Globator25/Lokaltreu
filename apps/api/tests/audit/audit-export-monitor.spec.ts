import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditExportRepository } from "../../src/modules/audit/export/audit-export.repo.js";
import {
  checkAuditExportGaps,
  InMemoryAuditGapCounter,
} from "../../src/modules/audit/export/audit-export.monitor.js";
import { computeWormHash } from "../../src/modules/audit/worm/worm-writer.js";

describe("audit export gap monitor", () => {
  it("triggers alert when gap exceeds threshold", async () => {
    const repo = new InMemoryAuditExportRepository();
    const counter = new InMemoryAuditGapCounter();
    const alert = vi.fn();
    const now = new Date("2026-01-01T00:30:00.000Z");

    const base = {
      tenantId: "tenant-1",
      ts: new Date("2026-01-01T00:00:00.000Z"),
      action: "admin.login",
      result: "SUCCESS",
      deviceId: null,
      cardId: null,
      jti: null,
      correlationId: "corr-1",
    };
    const hash = computeWormHash(base, "", 1);
    repo.seedWormEvent({
      tenantId: base.tenantId,
      seq: 1,
      ts: base.ts,
      action: base.action,
      result: base.result,
      deviceId: base.deviceId,
      cardId: base.cardId,
      jti: base.jti,
      correlationId: base.correlationId,
      prevHash: "",
      hash,
    });

    const run = await repo.createRun({
      runId: "run-1",
      tenantId: "tenant-1",
      fromSeq: 1,
      toSeq: 1,
    });
    if (!run) {
      throw new Error("run not created");
    }
    await repo.markSuccess({
      runId: "run-1",
      exportedAt: new Date("2026-01-01T00:00:00.000Z"),
      objectKey: "audit/tenant=tenant-1/date=2026-01-01/from_1_to_1",
    });

    const summary = await checkAuditExportGaps({
      repo,
      gapMinutes: 15,
      now: () => now,
      counter,
      alertHook: alert,
    });

    expect(summary.gapEvents).toBe(1);
    expect(counter.value).toBe(1);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("does not alert when gap is within threshold", async () => {
    const repo = new InMemoryAuditExportRepository();
    const counter = new InMemoryAuditGapCounter();
    const alert = vi.fn();
    const now = new Date("2026-01-01T00:10:00.000Z");

    const base = {
      tenantId: "tenant-1",
      ts: new Date("2026-01-01T00:00:00.000Z"),
      action: "admin.login",
      result: "SUCCESS",
      deviceId: null,
      cardId: null,
      jti: null,
      correlationId: "corr-2",
    };
    const hash = computeWormHash(base, "", 1);
    repo.seedWormEvent({
      tenantId: base.tenantId,
      seq: 1,
      ts: base.ts,
      action: base.action,
      result: base.result,
      deviceId: base.deviceId,
      cardId: base.cardId,
      jti: base.jti,
      correlationId: base.correlationId,
      prevHash: "",
      hash,
    });

    const run = await repo.createRun({
      runId: "run-2",
      tenantId: "tenant-1",
      fromSeq: 1,
      toSeq: 1,
    });
    if (!run) {
      throw new Error("run not created");
    }
    await repo.markSuccess({
      runId: "run-2",
      exportedAt: new Date("2026-01-01T00:00:00.000Z"),
      objectKey: "audit/tenant=tenant-1/date=2026-01-01/from_1_to_1",
    });

    const summary = await checkAuditExportGaps({
      repo,
      gapMinutes: 15,
      now: () => now,
      counter,
      alertHook: alert,
    });

    expect(summary.gapEvents).toBe(0);
    expect(counter.value).toBe(0);
    expect(alert).not.toHaveBeenCalled();
  });
});
