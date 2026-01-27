import { describe, expect, it, vi } from "vitest";
import { createDbReferralRepository } from "./referrals.db.js";
import type { DbClientLike, DbTransactionLike } from "./referrals.repo.js";

describe("referrals.db repository", () => {
  it("findByCode returns null when not found and maps rows when found", async () => {
    const query = vi
      .fn<DbClientLike["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            code: "ref-1",
            tenant_id: "tenant-a",
            referrer_card_id: "card-referrer",
            referred_card_id: "card-referred",
            qualified: true,
            first_stamp_at: "2026-01-01T00:00:00.000Z",
            bonus_credited_at: "2026-01-02T00:00:00.000Z",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        rowCount: 1,
      });

    const repo = createDbReferralRepository({ query } as unknown as DbClientLike);

    await expect(repo.findByCode("missing")).resolves.toBeNull();

    const record = await repo.findByCode("ref-1");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM referrals"), ["ref-1"]);
    expect(record).toMatchObject({
      code: "ref-1",
      tenantId: "tenant-a",
      referrerCardId: "card-referrer",
      referredCardId: "card-referred",
      qualified: true,
    });
    expect(record?.firstStampAt).toBeInstanceOf(Date);
    expect(record?.bonusCreditedAt).toBeInstanceOf(Date);
    expect(record?.createdAt).toBeInstanceOf(Date);
  });

  it("uses transaction client when provided", async () => {
    const dbQuery = vi.fn<DbClientLike["query"]>(async () => ({ rows: [], rowCount: 0 }));
    const txQuery = vi.fn<DbTransactionLike["query"]>(async () => ({
      rows: [
        {
          code: "ref-2",
          tenant_id: "tenant-a",
          referrer_card_id: "card-a",
          referred_card_id: null,
          qualified: false,
          first_stamp_at: null,
          bonus_credited_at: null,
          created_at: "2026-01-03T00:00:00.000Z",
        },
      ],
      rowCount: 1,
    }));

    const repo = createDbReferralRepository({ query: dbQuery } as unknown as DbClientLike);
    const tx = { query: txQuery } as unknown as DbTransactionLike;

    const record = await repo.findActiveByReferrer("tenant-a", "card-a", tx);

    expect(txQuery).toHaveBeenCalledTimes(1);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(record?.tenantId).toBe("tenant-a");
  });

  it("qualifyReferral and markBonusCredited return booleans based on rowCount", async () => {
    const query = vi
      .fn<DbClientLike["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const repo = createDbReferralRepository({ query } as unknown as DbClientLike);

    const firstStampAt = new Date("2026-01-04T00:00:00.000Z");
    await expect(
      repo.qualifyReferral({ code: "ref-3", tenantId: "tenant-a", referredCardId: "card-b", firstStampAt }),
    ).resolves.toBe(true);
    await expect(
      repo.qualifyReferral({ code: "ref-3", tenantId: "tenant-a", referredCardId: "card-b", firstStampAt }),
    ).resolves.toBe(false);

    const creditedAt = new Date("2026-01-05T00:00:00.000Z");
    await expect(
      repo.markBonusCredited({ code: "ref-3", tenantId: "tenant-a", creditedAt }),
    ).resolves.toBe(true);
    await expect(
      repo.markBonusCredited({ code: "ref-3", tenantId: "tenant-a", creditedAt }),
    ).resolves.toBe(false);
  });

  it("countQualifiedForMonth converts string counts and defaults to 0 on empty", async () => {
    const query = vi
      .fn<DbClientLike["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1 });

    const repo = createDbReferralRepository({ query } as unknown as DbClientLike);
    const monthStart = new Date("2026-01-01T00:00:00.000Z");
    const monthEnd = new Date("2026-02-01T00:00:00.000Z");

    await expect(
      repo.countQualifiedForMonth({ tenantId: "tenant-a", referrerCardId: "card-a", monthStart, monthEnd }),
    ).resolves.toBe(0);

    const count = await repo.countQualifiedForMonth({
      tenantId: "tenant-a",
      referrerCardId: "card-a",
      monthStart,
      monthEnd,
    });
    expect(count).toBe(5);
  });

  it("hasFirstStamp and markFirstStampIfAbsent reflect rowCount", async () => {
    const query = vi
      .fn<DbClientLike["query"]>()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const repo = createDbReferralRepository({ query } as unknown as DbClientLike);

    await expect(repo.hasFirstStamp({ tenantId: "tenant-a", cardId: "card-a" })).resolves.toBe(true);
    await expect(repo.hasFirstStamp({ tenantId: "tenant-a", cardId: "card-a" })).resolves.toBe(false);

    const firstStampAt = new Date("2026-01-06T00:00:00.000Z");
    await expect(
      repo.markFirstStampIfAbsent({ tenantId: "tenant-a", cardId: "card-a", firstStampAt }),
    ).resolves.toBe(true);
    await expect(
      repo.markFirstStampIfAbsent({ tenantId: "tenant-a", cardId: "card-a", firstStampAt }),
    ).resolves.toBe(false);
  });
});
