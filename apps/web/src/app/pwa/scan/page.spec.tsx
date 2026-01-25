// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScanPage from "./page";

const tenantId = "11111111-1111-4111-8111-111111111111";
const cardId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PwaScanPage", () => {
  it("submits qrToken and renders success", async () => {
    localStorage.setItem("lt_tenant_id", tenantId);
    localStorage.setItem("lt_card_id", cardId);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => idempotencyKey),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          cardState: { currentStamps: 1, stampsRequired: 10, rewardsAvailable: 0 },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanPage />);

    fireEvent.change(screen.getByLabelText("QR-Token"), {
      target: { value: "qr-token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stempel einloesen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/stamps/claim");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    });
    expect(init?.body).toBe(JSON.stringify({ qrToken: "qr-token-123" }));

    expect(await screen.findByText("Stempel erfolgreich eingeloest.")).toBeInTheDocument();
  });

  it("renders problem details on error", async () => {
    localStorage.setItem("lt_tenant_id", tenantId);
    localStorage.setItem("lt_card_id", cardId);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => idempotencyKey),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://errors.lokaltreu.example/token/reuse",
          title: "Token reuse",
          status: 409,
          detail: "Token already used.",
          correlation_id: "corr-456",
        }),
        {
          status: 409,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanPage />);

    fireEvent.change(screen.getByLabelText("QR-Token"), {
      target: { value: "qr-token-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stempel einloesen" }));

    expect(await screen.findByText("Token already used.")).toBeInTheDocument();
    expect(await screen.findByText("correlation_id: corr-456")).toBeInTheDocument();
  });
});

