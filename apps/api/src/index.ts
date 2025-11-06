import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { createNotFoundProblem } from "@lokaltreu/types";
import router from "./routes/index.js";
import { secureActionRouter } from "./routes/secureAction.js";
import { globalErrorHandler } from "./middleware/errors/globalErrorHandler.js";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:14317",
  }) as unknown as never,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(router);
app.use(secureActionRouter);

function readHeader(req: Request, name: string): string | undefined {
  const viaGet = req.get(name);
  if (viaGet && viaGet.trim().length > 0) {
    return viaGet;
  }
  const raw = req.headers[name.toLowerCase() as keyof typeof req.headers];
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  return undefined;
}

app.use((req: Request, res: Response) => {
  const fallbackRequestId = readHeader(req, "x-request-id") ?? randomUUID();
  const correlationId = readHeader(req, "x-correlation-id") ?? fallbackRequestId;

  res.status(404).type("application/problem+json").json(createNotFoundProblem(correlationId));
});

app.use(globalErrorHandler);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`API up on :${PORT}`);
});
