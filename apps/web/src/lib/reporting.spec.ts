import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api/fetch-with-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

describe("reporting auth header", () => {
  const originalToken = process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN;

  afterEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN = originalToken;
    vi.clearAllMocks();
  });

  it("sets Authorization header when NEXT_PUBLIC_ADMIN_MOCK_TOKEN is set", async () => {
    process.env.NEXT_PUBLIC_ADMIN_MOCK_TOKEN = "demo-token";
    vi.resetModules();

    const mod = await import("./reporting");
    const { getAdminReportingSummary } = mod;
    type Summary200 = import("./reporting").Summary200;
    const { fetchWithTimeout } = await import("./api/fetch-with-timeout");

    const summary: Summary200 = {
      stamps: { day: 1, week: 2, month: 3 },
      rewards: { day: 0, week: 1, month: 2 },
      referrals: {
        linksIssued: { day: 0, week: 0, month: 1 },
        qualified: { day: 0, week: 0, month: 0 },
        bonusStamps: { day: 0, week: 0, month: 0 },
        conversionRate: { day: 0, week: 0, month: 0 },
      },
      deviceActivity: { activeDevices: 1 },
      planUsage: {
        period: "2025-09",
        stampsUsed: 3,
        stampsLimit: 120,
        usagePercent: 2,
        warningEmitted: false,
        upgradeSignalEmitted: false,
      },
      activeCampaigns: 1,
    };

    const fetchMock = vi.mocked(fetchWithTimeout);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => summary,
    } as Response);

    await getAdminReportingSummary();

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ Authorization: "Bearer demo-token" });
  });
});
