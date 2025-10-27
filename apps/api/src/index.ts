import express from "express";
import type { NextFunction, Request, Response } from "express";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { NOT_FOUND_PROBLEM, createInternalServerErrorProblem } from "@lokaltreu/types";
import router from "./routes/index.js";
import { secureActionRouter } from "./routes/secureAction.js";

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

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId =
    typeof (req as Record<string, unknown>).id === "string" ? (req as Record<string, string>).id : "unknown-request";
  // Wichtig (SPEC): Keine PII in Logs. Niemals vollstaendige Request-Bodies mit Personenbezug oder Tokens loggen.
  // Nur technische Metadaten (requestId, route, statusCode) loggen.
  console.error("[unhandled-error]", {
    requestId,
    path: req.path,
    method: req.method,
    message: err?.message,
  });
  res.status(500).type("application/problem+json").json(createInternalServerErrorProblem(requestId, err?.message));
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`API up on :${PORT}`);
});
