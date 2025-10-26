import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("lokaltreu-api");

export const tokenInvalid = meter.createCounter("rate_token_invalid");
export const tokenReuse = meter.createCounter("rate_token_reuse");
