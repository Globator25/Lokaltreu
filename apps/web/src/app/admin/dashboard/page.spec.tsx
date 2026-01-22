// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboardPage from "./page";
import { getAdminReportingSummary, type Summary200 } from "../../../lib/reporting";

vi.mock("next/dynamic", () => ({
  default: () => () => <div>Timeseries stub</div>,
}));

vi.mock("../../../lib/reporting", () => ({
  getAdminReportingSummary: vi.fn(),
}));

describe("AdminDashboardPage", () => {
  it("renders summary KPI values", async () => {
    const summary: Summary200 = {
      stamps: { day: 11, week: 22, month: 33 },
      rewards: { day: 44, week: 55, month: 66 },
      referrals: {
        linksIssued: { day: 7, week: 8, month: 9 },
        qualified: { day: 12, week: 13, month: 14 },
        bonusStamps: { day: 15, week: 16, month: 17 },
        conversionRate: { day: 18, week: 19, month: 20 },
      },
      deviceActivity: { activeDevices: 2 },
      planUsage: {
        period: "2025-09",
        stampsUsed: 77,
        stampsLimit: 120,
        usagePercent: 64,
        warningEmitted: false,
        upgradeSignalEmitted: false,
      },
      activeCampaigns: 1,
    };

    const summaryMock = vi.mocked(getAdminReportingSummary);
    summaryMock.mockResolvedValue(summary);

    render(<AdminDashboardPage />);

    expect(await screen.findByText("Stempel")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText("33")).toBeInTheDocument();
  });
});
