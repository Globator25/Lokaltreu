// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StaffStampsPage from "./page";
import { createStampToken } from "../../../lib/api/staff/stamps";
import { defaultProblemType } from "../../../lib/api/problem";

vi.mock("../../../lib/api/staff/stamps", () => ({
  createStampToken: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetAllMocks();
});

describe("StaffStampsPage", () => {
  it("shows a German network error message when service is unreachable", async () => {
    const createMock = vi.mocked(createStampToken);
    createMock.mockResolvedValue({
      ok: false,
      problem: {
        type: defaultProblemType,
        status: 503,
        title: "Network error",
        detail: "Service not reachable. Please try again.",
      },
    });

    render(<StaffStampsPage />);

    fireEvent.change(screen.getByLabelText("Device Key"), {
      target: { value: "device-key" },
    });
    fireEvent.change(screen.getByLabelText("Device Timestamp (seconds)"), {
      target: { value: "1737686400" },
    });
    fireEvent.change(screen.getByLabelText("Device Proof"), {
      target: { value: "proof" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Neuen Code erzeugen" }));

    expect(
      await screen.findByText(
        "Service nicht erreichbar. Bitte Prism/Backend starten und erneut versuchen.",
      ),
    ).toBeInTheDocument();
  });

  it("prevents submit when timestamp is invalid", async () => {
    const createMock = vi.mocked(createStampToken);
    createMock.mockResolvedValue({
      ok: true,
      data: { qrToken: "qr", jti: "jti", expiresAt: "2026-01-24T10:00:00Z" },
    });

    render(<StaffStampsPage />);

    fireEvent.change(screen.getByLabelText("Device Key"), {
      target: { value: "device-key" },
    });
    fireEvent.change(screen.getByLabelText("Device Timestamp (seconds)"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByLabelText("Device Proof"), {
      target: { value: "proof" },
    });

    const button = screen.getByRole("button", { name: "Neuen Code erzeugen" });
    expect(button).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
