import http from "node:http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { replayStore } from "./security/tokens/replayStore.js";
import { tooManyRequests } from "./security/errors/problem.js";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:14317",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!req.url) {
    sendJson(res, 400, {
      type: "https://lokaltreu/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Missing request URL",
    });
    return;
  }

  const requestUrl = new URL(req.url, "http://localhost");

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    res.statusCode = 200;
    res.end("OK");
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/secure-action") {
    const jti = requestUrl.searchParams.get("jti") ?? "";
    if (!jti) {
      sendJson(res, 429, tooManyRequests("missing jti"));
      return;
    }

    const fresh = await replayStore.checkAndSetJti(jti, 60);
    if (!fresh) {
      sendJson(res, 429, tooManyRequests("replay detected for this jti"));
      return;
    }

    sendJson(res, 200, { ok: true, jti });
    return;
  }

  sendJson(res, 404, {
    type: "https://lokaltreu/errors/not-found",
    title: "Not Found",
    status: 404,
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("Unhandled request error", err);
    if (!res.headersSent) {
      sendJson(res, 500, {
        type: "https://lokaltreu/errors/internal",
        title: "Internal Server Error",
        status: 500,
      });
    } else {
      res.destroy();
    }
  });
});

server.listen(3001, () => {
  console.log("API up on :3001");
});
