import React from "react";
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page";
test("should render", () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain("Get started by editing");
});
