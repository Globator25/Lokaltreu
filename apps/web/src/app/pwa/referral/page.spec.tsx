// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReferralPage from "./page";

const tenantId = "11111111-1111-4111-8111-111111111111";
const cardId = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PwaReferralPage", () => {
  it("loads referral link with tenant/card headers and renders the link", async () => {
    localStorage.setItem("lt_tenant_id", tenantId);
    localStorage.setItem("lt_card_id", cardId);
    window.history.pushState({}, "", `/pwa/referral?tenant=${tenantId}&card=${cardId}`);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refCodeURL: "https://example.com/ref" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReferralPage />);

    fireEvent.click(screen.getByRole("button", { name: "Referral-Link laden" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/referrals/link");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({
      "x-tenant-id": tenantId,
      "x-card-id": cardId,
    });

    expect(await screen.findByRole("link", { name: "https://example.com/ref" })).toBeInTheDocument();
  });

  it("renders problem details and correlation id on error", async () => {
    localStorage.setItem("lt_tenant_id", tenantId);
    localStorage.setItem("lt_card_id", cardId);
    window.history.pushState({}, "", `/pwa/referral?tenant=${tenantId}&card=${cardId}`);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://errors.lokaltreu.example/rate-limited",
          title: "Rate limited",
          status: 429,
          detail: "Too many requests.",
          correlation_id: "abc-123",
        }),
        {
          status: 429,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReferralPage />);

    fireEvent.click(screen.getByRole("button", { name: "Referral-Link laden" }));

    expect(await screen.findByText("Too many requests.")).toBeInTheDocument();
    expect(await screen.findByText("correlation_id: abc-123")).toBeInTheDocument();
  });
});

