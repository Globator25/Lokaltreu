// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PwaDsrPage from "./page";
import { createDsrRequest, getDsrRequest } from "../../../lib/api/pwa/dsr";

vi.mock("../../../lib/api/pwa/dsr", () => ({
  createDsrRequest: vi.fn(),
  getDsrRequest: vi.fn(),
}));

function resetUrl(path = "/pwa/dsr") {
  window.history.pushState({}, "", path);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetAllMocks();
  resetUrl();
});

describe("PwaDsrPage", () => {
  it("submits a DSR request and shows confirmation", async () => {
    resetUrl();
    const createMock = vi.mocked(createDsrRequest);
    createMock.mockResolvedValue({
      ok: true,
      data: {
        dsrRequestId: "11111111-2222-3333-4444-555555555555",
        status: "PENDING",
        requestType: "DELETE",
        subject: { subject_type: "card_id", subject_id: "card-123" },
        createdAt: "2026-01-08T12:00:00Z",
      },
    });

    render(<PwaDsrPage />);

    fireEvent.change(screen.getByLabelText("Card-ID"), {
      target: { value: "card-123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "DSR-Anfrage senden" }));

    expect(await screen.findByText("Anfrage eingegangen")).toBeInTheDocument();
    expect(
      await screen.findByText("DSR-ID: 11111111-2222-3333-4444-555555555555"),
    ).toBeInTheDocument();
  });

  it("loads status by DSR id", async () => {
    resetUrl();
    const statusMock = vi.mocked(getDsrRequest);
    statusMock.mockResolvedValue({
      ok: true,
      data: {
        dsrRequestId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        status: "PENDING",
        requestType: "DELETE",
        subject: { subject_type: "card_id", subject_id: "card-456" },
        createdAt: "2026-01-08T12:00:00Z",
        fulfilledAt: null,
      },
    });

    render(<PwaDsrPage />);

    fireEvent.change(screen.getByLabelText("DSR-ID"), {
      target: { value: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Status abrufen" }));

    expect(await screen.findByText("Status: PENDING")).toBeInTheDocument();
    expect(await screen.findByText("Card-ID: card-456")).toBeInTheDocument();
  });

  it("shows a German network error message when service is unreachable", async () => {
    resetUrl();
    const createMock = vi.mocked(createDsrRequest);
    createMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 503,
        title: "Network error",
        detail: "Service not reachable. Please try again.",
      },
    });

    render(<PwaDsrPage />);

    fireEvent.change(screen.getByLabelText("Card-ID"), {
      target: { value: "card-999" },
    });

    fireEvent.click(screen.getByRole("button", { name: "DSR-Anfrage senden" }));

    expect(
      await screen.findByText(
        "Service nicht erreichbar. Bitte Prism/Backend starten und erneut versuchen.",
      ),
    ).toBeInTheDocument();
  });
});
