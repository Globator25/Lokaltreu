import { describe, expect, it } from "vitest";
import { buildDevResponse, resolveDevPort } from "./dev-server-helpers";

describe("resolveDevPort", () => {
  it("prefers PORT over DEV_API_PORT", () => {
    const port = resolveDevPort({ PORT: "5050", DEV_API_PORT: "6000" });
    expect(port).toBe(5050);
  });

  it("falls back to DEV_API_PORT and default", () => {
    expect(resolveDevPort({ DEV_API_PORT: "7000" })).toBe(7000);
    expect(resolveDevPort({})).toBe(4010);
  });
});

describe("buildDevResponse", () => {
  it("returns plain text ok for GET /", () => {
    const response = buildDevResponse("GET", "/");
    expect(response).toEqual({
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    });
  });

  it("returns JSON stub for hot POST routes", () => {
    const response = buildDevResponse("POST", "/stamps/claim");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(() => {
      JSON.parse(response.body);
    }).not.toThrow();
  });

  it("default route returns 404", () => {
    const response = buildDevResponse("DELETE", "/unknown");
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe("not found");
  });
});
