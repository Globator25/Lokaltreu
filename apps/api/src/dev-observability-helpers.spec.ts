import { describe, expect, it, vi } from "vitest";
import {
  createDevObservabilityContext,
  createGracefulShutdownHandler,
  createSmokeSignalEmitter,
} from "./dev-observability-helpers";

describe("createDevObservabilityContext", () => {
  it("derives env from DEPLOYMENT_ENVIRONMENT", () => {
    const ctx = createDevObservabilityContext({
      DEPLOYMENT_ENVIRONMENT: "stage",
      PORT: "4800",
    });
    expect(ctx.env).toBe("stage");
    expect(ctx.labels.env).toBe("stage");
    expect(ctx.port).toBe(4800);
  });

  it("falls back to NODE_ENV and defaults", () => {
    const ctx = createDevObservabilityContext({ NODE_ENV: "test" });
    expect(ctx.env).toBe("test");
    expect(ctx.port).toBe(4010);
  });

  it("coerces DEV_API_PORT when PORT absent", () => {
    const ctx = createDevObservabilityContext({ DEV_API_PORT: "5050" });
    expect(ctx.port).toBe(5050);
  });
});

describe("createSmokeSignalEmitter", () => {
  it("logs after the configured wait using injected timer", async () => {
    const warn = vi.fn();
    let scheduled: (() => void) | undefined;
    const setTimeoutFn = (cb: () => void) => {
      scheduled = cb;
      return {} as NodeJS.Timeout;
    };
    const emit = createSmokeSignalEmitter({
      waitMs: 100,
      message: "tick",
      logger: { warn },
      setTimeoutFn,
    });
    const promise = emit();
    scheduled?.();
    await promise;
    expect(warn).toHaveBeenCalledWith("tick");
  });
});

describe("createGracefulShutdownHandler", () => {
  it("closes server, shuts down observability, and exits", async () => {
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const shutdownObservability = vi.fn().mockResolvedValue(undefined);
    const exitCalls: number[] = [];
    const exit = ((code: number) => {
      exitCalls.push(code);
      return undefined as never;
    }) as (code: number) => never;
    const logger = { warn: vi.fn(), error: vi.fn() };
    const handler = createGracefulShutdownHandler({
      closeServer,
      shutdownObservability,
      exit,
      logger,
    });

    await handler("SIGINT");

    expect(logger.warn).toHaveBeenCalledWith("[dev] received SIGINT, shutting down …");
    expect(closeServer).toHaveBeenCalled();
    expect(shutdownObservability).toHaveBeenCalled();
    expect(exitCalls).toEqual([0]);
  });
});
