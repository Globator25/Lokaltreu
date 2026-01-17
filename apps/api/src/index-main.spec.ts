import { describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const { listenMock, createServerMock } = vi.hoisted(() => {
  const listenMock = vi.fn();
  const createServerMock = vi.fn(() => ({ listen: listenMock } as { listen: typeof listenMock }));
  return { listenMock, createServerMock };
});

vi.mock("node:http", () => ({
  createServer: createServerMock,
  default: { createServer: createServerMock },
}));

import { createServer } from "node:http";

describe("index.ts main entrypoint", () => {
  it("starts the server when executed as the main module", async () => {
    const indexUrl = new URL("./index.ts", import.meta.url);
    const originalArgv1 = process.argv[1];
    process.argv[1] = fileURLToPath(indexUrl);

    try {
      await import(indexUrl.href);

      expect(createServer).toHaveBeenCalledTimes(1);
      expect(listenMock).toHaveBeenCalledTimes(1);
    } finally {
      process.argv[1] = originalArgv1;
      listenMock.mockClear();
      createServerMock.mockClear();
    }
  }, 20000);
});
