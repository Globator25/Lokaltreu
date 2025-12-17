export {};

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { v4 as uuidv4 } from "uuid";

function getCorrelationId(): string {
  if (typeof window === "undefined") {
    return "cli-" + uuidv4();
  }

  const storageKey = "lokaltreu-correlation-id";

  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const cryptoUuid =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : undefined;

    const id = cryptoUuid ?? uuidv4();
    window.sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    return uuidv4();
  }
}

function patchFetch(): void {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const correlationId = getCorrelationId();
    const headers = new Headers();

    const applyHeaders = (source?: HeadersInit) => {
      if (!source) return;
      new Headers(source).forEach((value, key) => headers.set(key, value));
    };

    if (input instanceof Request) {
      applyHeaders(input.headers);
    }
    applyHeaders(init?.headers);

    headers.set("x-correlation-id", correlationId);

    const nextInit: RequestInit = {
      ...init,
      headers,
    };

    if (input instanceof Request) {
      const requestClone = new Request(input, nextInit);
      return originalFetch(requestClone);
    }

    return originalFetch(input, nextInit);
  };
}

declare global {
  interface Window {
    __lokaltreuWebOtelInitialized?: boolean;
  }
}

function initWebTracing(): void {
  if (typeof window === "undefined") return;
  if (window.__lokaltreuWebOtelInitialized) return;
  window.__lokaltreuWebOtelInitialized = true;

  const endpoint = (process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318")
    .replace(/\/$/, "");

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME ?? "lokaltreu-web",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT ?? "dev",
  });

  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
        applyCustomAttributesOnSpan: (span) => {
          span.setAttribute("app.telemetry", "lokaltreu-web");
        },
      }),
    ],
  });

  patchFetch();
}

initWebTracing();
