// Lokaltreu API – minimalistischer HTTP-Server mit OTel, Log-Korrelation und RFC 7807.

import "./observability/otel.js"; // OTel/Tracing unbedingt zuerst laden (Side-Effect-Start)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { trace, SpanStatusCode } from "@opentelemetry/api";

// ⚠️ ESM: lokale Importe mit .js-Endung!
import { getLog } from "./observability/logging.js";

/* ----------------------------- Hilfsfunktionen ----------------------------- */

function readCorrelationId(req: IncomingMessage): string {
  const hdr =
    (req.headers["x-correlation-id"] || req.headers["x-request-id"]) as string | undefined;
  return (hdr && hdr.toString()) || randomUUID().replace(/-/g, "");
}

function sendJSON(
  res: ServerResponse & { locals?: any },
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const h = {
    "content-type": "application/json; charset=utf-8",
    "x-correlation-id": res.locals?.correlationId ?? "",
    ...headers,
  };
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
}

function sendProblem(
  res: ServerResponse & { locals?: any },
  status: number,
  title: string,
  detail: string
) {
  const correlation_id = res.locals?.correlationId ?? "";
  const problem = { type: "about:blank", title, status, detail, correlation_id };
  res.writeHead(status, {
    "content-type": "application/problem+json; charset=utf-8",
    "x-correlation-id": correlation_id,
  });
  res.end(JSON.stringify(problem));
}

/* --------------------------------- Server --------------------------------- */

const server = createServer(async (req: IncomingMessage, res: ServerResponse & { locals?: any }) => {
  try {
    // Per-Request-Context
    res.locals = res.locals || {};
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;

    // 1) Korrelation GANZ früh
    res.locals.correlationId = readCorrelationId(req);

    // 2) Route-Label für konsistente Dashboards/Alerts
    res.locals.routeId = path;

    // 3) Request-Dauer-Logging (für p50/p95/p99)
    const start = performance.now();
    res.on("finish", () => {
      const ms = Math.max(0, performance.now() - start);
      // getLog() liefert trace_id/span_id per OTel-Context
      getLog().info(
        {
          route: res.locals?.routeId || path,
          method: req.method ?? "",
          status: String(res.statusCode),
          duration_ms: Math.round(ms),
          tenant_id: res.locals?.tenantId,            // pseudonym (falls gesetzt)
          correlation_id: res.locals?.correlationId,  // für Log↔Trace↔Problem
        },
        "http_request_done"
      );
    });

    // --- Beispiel-Route: /health mit explizitem Span ---
    if (req.method === "GET" && path === "/health") {
      trace.getTracer("lokaltreu-api").startActiveSpan("health-check", (span) => {
        try {
          span.setAttribute("http.method", "GET");
          span.setAttribute("http.route", "/health");
          sendJSON(res, 200, { status: "ok" });
        } catch (e: any) {
          span.recordException(e);
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e?.message ?? e) });
          throw e;
        } finally {
          span.end();
        }
      });
      return;
    }
    // ----------------------------------------------------

    // Unbekannte Route → RFC 7807
    getLog().info(
      { correlation_id: res.locals.correlationId, method: req.method ?? "", path },
      "route_not_found"
    );
    sendProblem(res, 404, "Not Found", `Route ${path} existiert nicht.`);
  } catch (err: any) {
    // Fallback-Fehler inkl. Correlation
    const cid = res.locals?.correlationId || randomUUID().replace(/-/g, "");
    res.locals = { ...(res.locals || {}), correlationId: cid };
    getLog().info({ correlation_id: cid, error: String(err?.message ?? err) }, "unhandled_error");
    try {
      sendProblem(res, 500, "Internal Server Error", "Unerwarteter Fehler.");
    } catch {
      res.destroy();
    }
  }
});

function emitStartupTest() {
  // eindeutiger Marker, damit wir die Zeile in Loki sicher finden
  getLog().info(
    {
      route: "/health",
      method: "GET",
      status: "200",
      duration_ms: 5,
      marker: "manual-test",
    },
    "manual-test"
  );
}

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
  getLog().info({ port: PORT }, "lokaltreu_api_started");
  emitStartupTest(); // Test-Log beim Start
});

export default server;
