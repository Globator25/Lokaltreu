import pino from "pino";
import { context, trace } from "@opentelemetry/api";

export const logger = pino({ base: null });

export function logInfo(msg: string, extra: Record<string, unknown> = {}) {
  const span = trace.getSpan(context.active());
  const trace_id = span?.spanContext().traceId;
  const correlation_id = (extra as Record<string, unknown>)["correlation_id"];

  logger.info({ trace_id, correlation_id, ...extra }, msg);
}

export function logError(msg: string, extra: Record<string, unknown> = {}) {
  const span = trace.getSpan(context.active());
  const trace_id = span?.spanContext().traceId;
  const correlation_id = (extra as Record<string, unknown>)["correlation_id"];

  logger.error({ trace_id, correlation_id, ...extra }, msg);
}
