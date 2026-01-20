// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InviteDeviceModal } from "./InviteDeviceModal";
import { createDeviceRegistrationLink } from "../../lib/api/devices";

vi.mock("../../lib/api/devices", () => ({
  createDeviceRegistrationLink: vi.fn(),
}));

describe("InviteDeviceModal", () => {
  it("renders error message with support code", async () => {
    const createDeviceRegistrationLinkMock = vi.mocked(createDeviceRegistrationLink);
    createDeviceRegistrationLinkMock.mockResolvedValue({
      ok: false,
      problem: {
        status: 409,
        title: "Conflict",
        error_code: "TOKEN_REUSE",
        correlation_id: "support-123",
      },
    });

    render(<InviteDeviceModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Link erzeugen/i }));

    expect(
      await screen.findByText(/Support-Code: support-123/i),
    ).toBeInTheDocument();
  });
});
