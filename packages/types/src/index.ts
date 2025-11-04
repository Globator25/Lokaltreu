export type ProblemErrorCode =
  | "TOKEN_REUSE"
  | "DEVICE_PROOF_INVALID"
  | "DEVICE_PROOF_INVALID_TIME"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR"
  | "PLAN_NOT_ALLOWED"
  | "HEADERS_MISSING"
  | "IDEMPOTENT_REPLAY";

export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code: ProblemErrorCode;
  correlation_id: string;
  [key: string]: unknown;
}

export type ProblemJsonTitle =
  | "TOKEN_REUSE"
  | "DEVICE_PROOF_INVALID"
  | "DEVICE_PROOF_INVALID_TIME"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

export interface Components {
  schemas: {
    Problem: ProblemJson;
  };
}

export type components = Components;

export interface SecureActionOkResponse {
  ok: true;
}

export interface SecureDeviceOkResponse {
  ok: true;
}

export interface HealthCheckResponse {
  ok: true;
  service: "api";
}

export interface TokenReuseProblem extends ProblemJson {
  title: "TOKEN_REUSE";
  status: 409;
  type: "https://errors.lokaltreu.example/replay/token";
  detail: string;
  error_code: "TOKEN_REUSE";
}

export type DeviceProofRejectionReason =
  | "MISSING_HEADERS"
  | "UNKNOWN_DEVICE"
  | "INVALID_SIGNATURE"
  | "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW";

export interface DeviceProofProblem extends ProblemJson {
  title: "DEVICE_PROOF_INVALID" | "DEVICE_PROOF_INVALID_TIME";
  status: 401 | 403;
  type: "https://errors.lokaltreu.example/device/proof" | "https://errors.lokaltreu.example/device/proof-time";
  detail: DeviceProofRejectionReason;
  error_code: "DEVICE_PROOF_INVALID" | "DEVICE_PROOF_INVALID_TIME";
}

export interface NotFoundProblem extends ProblemJson {
  title: "NOT_FOUND";
  status: 404;
  type: "https://errors.lokaltreu.example/not-found";
  error_code: "NOT_FOUND";
}

export interface InternalServerErrorProblem extends ProblemJson {
  title: "INTERNAL_SERVER_ERROR";
  status: 500;
  type: "https://errors.lokaltreu.example/internal";
  requestId: string;
  error_code: "INTERNAL_SERVER_ERROR";
}

export const SECURE_ACTION_OK_RESPONSE: SecureActionOkResponse = Object.freeze({
  ok: true,
});

export const SECURE_DEVICE_OK_RESPONSE: SecureDeviceOkResponse = Object.freeze({
  ok: true,
});

export const HEALTH_CHECK_RESPONSE: HealthCheckResponse = Object.freeze({
  ok: true,
  service: "api",
});

export function createTokenReuseProblem(correlationId: string, detail = "jti replay within ttl"): TokenReuseProblem {
  return {
    type: "https://errors.lokaltreu.example/replay/token",
    title: "TOKEN_REUSE",
    status: 409,
    detail,
    error_code: "TOKEN_REUSE",
    correlation_id: correlationId,
  };
}

export function createDeviceProofProblem(
  reason: DeviceProofRejectionReason,
  correlationId: string
): DeviceProofProblem {
  const isTimeViolation = reason === "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW";
  const status: 401 | 403 = reason === "MISSING_HEADERS" || reason === "UNKNOWN_DEVICE" ? 401 : 403;

  return {
    type: isTimeViolation
      ? "https://errors.lokaltreu.example/device/proof-time"
      : "https://errors.lokaltreu.example/device/proof",
    title: isTimeViolation ? "DEVICE_PROOF_INVALID_TIME" : "DEVICE_PROOF_INVALID",
    status,
    detail: reason,
    error_code: isTimeViolation ? "DEVICE_PROOF_INVALID_TIME" : "DEVICE_PROOF_INVALID",
    correlation_id: correlationId,
  };
}

export function createNotFoundProblem(correlationId: string): NotFoundProblem {
  return {
    type: "https://errors.lokaltreu.example/not-found",
    title: "NOT_FOUND",
    status: 404,
    error_code: "NOT_FOUND",
    correlation_id: correlationId,
  };
}

export function createInternalServerErrorProblem(
  requestId: string,
  correlationId: string,
  detail?: string
): InternalServerErrorProblem {
  return {
    type: "https://errors.lokaltreu.example/internal",
    title: "INTERNAL_SERVER_ERROR",
    status: 500,
    requestId,
    error_code: "INTERNAL_SERVER_ERROR",
    correlation_id: correlationId,
    detail,
  };
}

export type SecurityMetricName = "deviceProofFailed" | "rate_token_reuse";

export interface MetricEvent {
  name: SecurityMetricName;
  value?: number;
  attributes?: Record<string, string>;
}
