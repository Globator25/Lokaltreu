import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import React, { type ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

// Next.js Image-Komponente für Tests durch ein einfaches <img> mocken
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => {
    // Für Tests reicht ein einfaches img-Element.
    // Wir setzen hier nur die A11y-Regel außer Kraft, weil die Props
    // nicht zwingend ein alt-Attribut enthalten müssen.
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("Page", () => {
  it("should render", () => {
    const { getByText } = render(<Page />);
    expect(getByText(/Get started by editing/i)).toBeInTheDocument();
  });
});
