// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TimeseriesSection from "./TimeseriesSection";
import {
  getAdminReportingTimeseries,
  type Timeseries200,
} from "../../lib/reporting";

vi.mock("../../lib/reporting", () => ({
  getAdminReportingTimeseries: vi.fn(),
}));

describe("TimeseriesSection", () => {
  it("renders a timeseries row and reloads on metric/bucket change", async () => {
    const payload: Timeseries200 = {
      metric: "stamps",
      bucket: "day",
      from: "2025-09-01T00:00:00.000Z",
      to: "2025-09-02T00:00:00.000Z",
      series: [
        {
          start: "2025-09-01T00:00:00.000Z",
          end: "2025-09-02T00:00:00.000Z",
          count: 5,
        },
      ],
    };

    const timeseriesMock = vi.mocked(getAdminReportingTimeseries);
    timeseriesMock.mockResolvedValue(payload);

    render(<TimeseriesSection />);

    expect(
      await screen.findByText("2025-09-01T00:00:00.000Z"),
    ).toBeInTheDocument();
    expect(screen.getByText("2025-09-02T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    const metricSelect = screen.getByLabelText("Metric");
    const bucketSelect = screen.getByLabelText("Bucket");

    fireEvent.change(metricSelect, { target: { value: "rewards" } });
    fireEvent.change(bucketSelect, { target: { value: "week" } });

    await waitFor(() => {
      expect(timeseriesMock).toHaveBeenCalledWith({
        metric: "rewards",
        bucket: "week",
      });
    });
  });
});
