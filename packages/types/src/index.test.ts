import { describe, it, expect } from "vitest";
import type { UserProfile } from "./index";

describe("@lokaltreu/types", () => {
  it("erstellt ein gültiges UserProfile-Objekt", () => {
    const profile: UserProfile = {
      id: "user-123",
      email: "test@example.com",
    };

    expect(profile.id).toBe("user-123");
    expect(profile.email).toBe("test@example.com");
  });
});
