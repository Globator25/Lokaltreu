import http from "node:http";
import { trace } from "@opentelemetry/api";
import {
  lokaltreuError5xxTotal,
  lokaltreuHttp429Total,
  lokaltreuReplayBlockedTotal,
} from "./observability/metrics";
import { resolveOtelConfig, shutdownObservability, startOtel } from "./observability/otel";

export type DevObservabilityContext = {
  env: string;
  labels: { env: string };
  port: number;
};

export type EnvLike = Record<string, string | undefined>;

export function createDevObservabilityContext(
  env: EnvLike = process.env,
): DevObservabilityContext {
  const resolvedEnv = env.DEPLOYMENT_ENVIRONMENT ?? env.NODE_ENV ?? "dev";
  const port = Number(env.PORT ?? env.DEV_API_PORT ?? 4010);
  return {
    env: resolvedEnv,
    labels: { env: resolvedEnv },
    port,
  };
}

type Logger = Pick<typeof console, "warn" | "error">;

type ShutdownDependencies = {
  closeServer: () => Promise<void>;
  shutdownObservability: () => Promise<void>;
  exit: (code: number) => never;
  logger?: Logger;
};

export function createGracefulShutdownHandler({
  closeServer,
  shutdownObservability,
  exit,
  logger = console,
}: ShutdownDependencies) {
  return async (signal: NodeJS.Signals): Promise<void> => {
    logger.warn(`[dev] received ${signal}, shutting down …`);
    await closeServer();
    await shutdownObservability();
    exit(0);
  };
}

type SmokeSignalOptions = {
  waitMs: number;
  message: string;
  logger?: Pick<typeof console, "warn">;
  setTimeoutFn?: (cb: () => void, ms: number) => NodeJS.Timeout;
};

export function createSmokeSignalEmitter({
  waitMs,
  message,
  logger = console,
  setTimeoutFn = setTimeout,
}: SmokeSignalOptions) {
  return () =>
    new Promise<void>((resolve) => {
      setTimeoutFn(() => {
        logger.warn(message);
        resolve();
      }, waitMs);
    });
}

export function runDevObservability(env: EnvLike = process.env): void {
  void startOtel(resolveOtelConfig(), { autoRegisterSignals: false });
  const { env: resolvedEnv, labels, port } = createDevObservabilityContext(env);

  const server = http.createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("lokaltreu api dev stub");
  });

  server.listen(port, () => {
    console.warn(`[dev] HTTP stub listening on http://localhost:${port}`);
  });

  server.on("error", (error) => {
    console.error("[dev] HTTP stub error", error);
    process.exit(1);
  });

  lokaltreuHttp429Total.add(1, labels);
  lokaltreuReplayBlockedTotal.add(1, labels);
  lokaltreuError5xxTotal.add(1, labels);

  const tracer = trace.getTracer("lokaltreu-dev-observability");
  tracer.startActiveSpan("dev.observability.smoke", (span) => {
    span.setAttribute("env", resolvedEnv);
    span.end();
  });

  const emitObservabilitySmokeSignals = createSmokeSignalEmitter({
    waitMs: 15_000,
    message: "[dev] emitted observability smoke signals (waited for export tick)",
  });

  void emitObservabilitySmokeSignals().catch((error) => {
    console.error("[dev] unexpected failure", error);
    process.exit(1);
  });

  const closeServer = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  const gracefulShutdown = createGracefulShutdownHandler({
    closeServer,
    shutdownObservability,
    exit: (code) => process.exit(code),
  });

  const handleSignal = (signal: NodeJS.Signals) => {
    void gracefulShutdown(signal).catch((error) => {
      console.error("[dev] graceful shutdown failed", error);
      process.exit(1);
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
}
