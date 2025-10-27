import http from "node:http";

// --- OpenTelemetry Bootstrap ---
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";

// Collector läuft in Docker und wurde auf Host-Port 14317 gemappt.
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:14317",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Telemetrie starten
sdk.start();

// --- Minimal-HTTP-Server ---
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.end("OK");
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});

// Port 3001 für die API
server.listen(3001, () => {
  console.log("API up on :3001");
});
