import "./observability/otel";
import express from "express";
import { registerHealthRoute } from "./http/health";
import { withMetrics } from "./middleware/metrics";
import { withCorrelation } from "./middleware/correlation";
import { errorHandler } from "./middleware/errors";
import { logger } from "./observability/logging";

const app = express();

app.use(express.json());
app.use(withCorrelation);
app.use(withMetrics);

registerHealthRoute(app);

app.post("/stamps/claim", (_req, res) => {
  res.locals.routeId = "/stamps/claim";
  res.status(200).json({ ok: true, correlation_id: res.locals.correlation_id });
});

app.post("/rewards/redeem", (_req, res) => {
  res.locals.routeId = "/rewards/redeem";
  res.status(200).json({ ok: true, correlation_id: res.locals.correlation_id });
});

app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "api_started");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err?.code === "EADDRINUSE") {
    logger.error({ port }, "port_in_use");
    process.exit(1);
  }
  throw err;
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, "shutdown_begin");
  server.close(() => {
    logger.info({ signal }, "shutdown_complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error({ signal }, "shutdown_forced");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logger.error({ err: String(err?.stack ?? err) }, "uncaught_exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason: String(reason) }, "unhandled_rejection");
  process.exit(1);
});

export { app };
