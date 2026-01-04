import { describe, expect, it, vi } from "vitest";

async function loadHooks(nodeEnv?: string) {
  const previous = process.env.NODE_ENV;
  if (nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = nodeEnv;
  }
  vi.resetModules();
  const mod = await import("./test-hooks.js");
  process.env.NODE_ENV = previous;
  return mod;
}

describe("stamp test hooks", () => {
  it("no-ops when NODE_ENV is not test", async () => {
    const hooks = await loadHooks("production");
    hooks.recordStampClaim();
    hooks.recordStampClaim();
    expect(hooks.getStampClaimCount()).toBe(0);
    hooks.resetStampClaimCount();
    expect(hooks.getStampClaimCount()).toBe(0);
    expect(hooks.isStampTestHooksEnabled()).toBe(false);
  });

  it("tracks counts when NODE_ENV is test", async () => {
    const hooks = await loadHooks("test");
    hooks.resetStampClaimCount();
    hooks.recordStampClaim();
    hooks.recordStampClaim();
    expect(hooks.getStampClaimCount()).toBe(2);
    hooks.resetStampClaimCount();
    expect(hooks.getStampClaimCount()).toBe(0);
    expect(hooks.isStampTestHooksEnabled()).toBe(true);
  });
});
