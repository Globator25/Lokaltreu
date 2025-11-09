import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import Page from "./page";

describe("Page", () => {
  it("should render", () => {
    const { getByText } = render(<Page />);
    expect(getByText(/Get started by editing/i)).toBeInTheDocument();
  });
});
