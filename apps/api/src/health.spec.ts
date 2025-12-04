import { describe, expect, it } from "vitest";

import { add, classify } from "./health";

describe("health", () => {
  it("adds numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("classifies ok", () => {
    expect(classify(201)).toBe("ok");
  });

  it("classifies error", () => {
    expect(classify(409)).toBe("error");
  });

  it("classifies unknown", () => {
    expect(classify(101)).toBe("unknown");
  });
});
