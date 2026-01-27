// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProblemToast } from "./ProblemToast";
import { defaultProblemType, type Problem } from "../../lib/api/problem";

describe("ProblemToast", () => {
  it("renders mapped title/message and support code without leaking detail", () => {
    const problem: Problem = {
      type: defaultProblemType,
      status: 429,
      title: "Rate limited",
      error_code: "RATE_LIMITED",
      correlation_id: "support-42",
      retry_after: 12,
      detail: "Internal stack trace",
    };

    render(<ProblemToast problem={problem} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Too many requests")).toBeInTheDocument();
    expect(screen.getByText(/Too many requests\./i)).toBeInTheDocument();
    expect(screen.getByText(/Support-Code: support-42/i)).toBeInTheDocument();
    expect(screen.queryByText(/Internal stack trace/i)).not.toBeInTheDocument();
  });
});

