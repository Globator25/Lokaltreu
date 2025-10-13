// apps/api/src/observability/logging.ts
// Pino → Loki Transport + OTel Trace/Span-Korrelation (ESM)

import pino from 'pino';
import { context, trace } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';

const LOKI_HOST = process.env.LOKI_URL ?? 'http://localhost:3100';
const SERVICE   = process.env.OTEL_SERVICE_NAME ?? 'lokaltreu-api';

const transport = pino.transport({
  target: 'pino-loki',
  options: {
    host: LOKI_HOST,                 // z.B. http://localhost:3100
    batching: true,
    interval: 2,                     // schneller flushen
    labels: { app: 'api', service: SERVICE, env: process.env.NODE_ENV ?? 'dev' },
    // bei Bedarf: basicAuth, headers, timeout, agent, replaceTimestamp, messageKey …
  },
} as any);

// Transport-Fehler sichtbar machen
if (transport && typeof (transport as any).on === 'function') {
  (transport as any).on('error', (err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('pino-loki transport error:', err);
  });
}

export const logger = pino(
  {
    base: null,          // keine automatischen Basisfelder (PII vermeiden)
    messageKey: 'msg',   // standardisiert den Message-Key für LogQL (| json)
  },
  transport as any
);

// Child-Logger mit dynamischen trace_id/span_id aus OTel-Context
export function getLog() {
  return logger.child({
    get trace_id() {
      try { return trace.getSpan(context.active())?.spanContext().traceId; }
      catch { return undefined; }
    },
    get span_id() {
      try { return trace.getSpan(context.active())?.spanContext().spanId; }
      catch { return undefined; }
    },
  } as Record<string, unknown>);
}

// Convenience-Infos
export function logInfo(msg: string, extra: Record<string, unknown> = {}) {
  const e = { ...extra } as Record<string, unknown>;
  if (!e['correlation_id']) e['correlation_id'] = randomUUID().replace(/-/g, '');
  getLog().info(e, msg);
}

export function logError(msg: string, extra: Record<string, unknown> = {}) {
  const e = { ...extra } as Record<string, unknown>;
  if (!e['correlation_id']) e['correlation_id'] = randomUUID().replace(/-/g, '');
  getLog().error(e, msg);
}

// Optional: sauber flushen (z.B. in Tests/Shutdown-Hooks)
export async function flushLogs(): Promise<void> { 
 try {
  (logger as { flush?: () => void }).flush?.();
} catch { /* noop */ } }
