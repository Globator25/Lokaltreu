import { describe, expect, it } from "vitest";

import { createServer, healthPayload } from "./index";

describe("API entry point", () => {
  it("exposes a factory for the HTTP server", () => {
    expect(typeof createServer).toBe("function");
  });

  it("defines the default health payload", () => {
    expect(healthPayload).toMatchObject({
      status: "ok",
      service: expect.stringContaining("lokaltreu"),
    });
  });
});
