import { expect, test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page";

test("should render", () => {
  const html = renderToStaticMarkup(<Page />);
  expect(html).toContain("hello");
});
