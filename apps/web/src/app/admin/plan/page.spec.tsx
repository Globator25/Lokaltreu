// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminPlanPage from "./page";
import { getAdminPlan } from "../../../lib/api/adminPlan";
import { getCurrentOffer } from "../../../lib/api/adminOffer";

vi.mock("../../../lib/api/adminPlan", () => ({
  getAdminPlan: vi.fn(),
}));

vi.mock("../../../lib/api/adminOffer", () => ({
  getCurrentOffer: vi.fn(),
  putCurrentOffer: vi.fn(),
}));

describe("AdminPlanPage", () => {
  it("renders the plan heading", async () => {
    const planMock = vi.mocked(getAdminPlan);
    planMock.mockResolvedValue({
      ok: true,
      data: {
        planCode: "starter",
        features: { referral: false, offers: true },
        limits: { stampsPerMonth: 120, devicesAllowed: 2 },
        upgradeHint: null,
      },
    });

    const offerMock = vi.mocked(getCurrentOffer);
    offerMock.mockResolvedValue({
      ok: true,
      data: { offer: null, updatedAt: "2026-01-23T10:05:00Z" },
    });

    render(<AdminPlanPage />);

    expect(await screen.findByText("Plan")).toBeInTheDocument();
  });
});
