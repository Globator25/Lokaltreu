import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAdmin } from "./register-admin";

describe("registerAdmin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a problem when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await registerAdmin({
      email: "admin@example.com",
      password: "verylongpassword",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.title).toBe("Network error");
      expect(result.problem.status).toBe(503);
    }
  });
});
