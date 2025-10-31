export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export type ProblemJsonTitle =
  | "TOKEN_REUSE"
  | "DEVICE_PROOF_INVALID"
  | "DEVICE_PROOF_INVALID_TIME"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

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
  type: "about:blank";
  detail: string;
}

export type DeviceProofRejectionReason =
  | "MISSING_HEADERS"
  | "UNKNOWN_DEVICE"
  | "INVALID_SIGNATURE"
  | "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW";

export interface DeviceProofProblem extends ProblemJson {
  title: "DEVICE_PROOF_INVALID" | "DEVICE_PROOF_INVALID_TIME";
  status: 403;
  type: "about:blank";
  detail: DeviceProofRejectionReason;
}

export interface NotFoundProblem extends ProblemJson {
  title: "NOT_FOUND";
  status: 404;
}

export interface InternalServerErrorProblem extends ProblemJson {
  title: "INTERNAL_SERVER_ERROR";
  status: 500;
  requestId: string;
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

export const NOT_FOUND_PROBLEM: NotFoundProblem = Object.freeze({
  type: "https://lokaltreu/errors/not-found",
  title: "NOT_FOUND",
  status: 404,
});

export function createTokenReuseProblem(detail = "jti replay within ttl"): TokenReuseProblem {
  return {
    type: "about:blank",
    title: "TOKEN_REUSE",
    status: 409,
    detail,
  };
}

export function createDeviceProofProblem(reason: DeviceProofRejectionReason): DeviceProofProblem {
  if (reason === "TIMESTAMP_OUTSIDE_ALLOWED_WINDOW") {
    return {
      type: "about:blank",
      title: "DEVICE_PROOF_INVALID_TIME",
      status: 403,
      detail: reason,
    };
  }

  return {
    type: "about:blank",
    title: "DEVICE_PROOF_INVALID",
    status: 403,
    detail: reason,
  };
}

export function createInternalServerErrorProblem(requestId: string, detail?: string): InternalServerErrorProblem {
  return {
    type: "about:blank",
    title: "INTERNAL_SERVER_ERROR",
    status: 500,
    requestId,
    detail,
  };
}

export type SecurityMetricName = "deviceProofFailed" | "rate_token_reuse";

export interface MetricEvent {
  name: SecurityMetricName;
  value?: number;
  attributes?: Record<string, string>;
}
