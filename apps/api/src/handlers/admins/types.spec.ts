import { describe, it, expect } from "vitest";

describe("handlers/admins/types", () => {
  it("module can be imported (types-only module should not throw)", async () => {
    const mod = await import("./types.js");
    expect(mod).toBeDefined();
  });
});
