import express from "express";
import type { Request, Response } from "express";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { NOT_FOUND_PROBLEM } from "@lokaltreu/types";
import router from "./routes/index.js";
import { secureActionRouter } from "./routes/secureAction.js";
import { globalErrorHandler } from "./middleware/errors/globalErrorHandler.js";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:14317",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(router);
app.use(secureActionRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).type("application/problem+json").json(NOT_FOUND_PROBLEM);
});

app.use(globalErrorHandler);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`API up on :${PORT}`);
});
