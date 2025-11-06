import type { Problem } from "@lokaltreu/config";

// Platzhalter-Typen bis SPEC Schemas liefert
export type DeviceProofRejectionReason = string;

// Von Code erwartetes Event-Shape
export type MetricEvent = {
  name: string;
  value?: number;
  attributes?: Record<string, string | number | boolean>;
};
export type SecurityMetricName = string;

export const HEALTH_CHECK_RESPONSE = { ok: true } as const;

export const createDeviceProofProblem = (detail: string, _corrId?: string): Problem => ({
  type: "https://errors.lokaltreu.dev/device-proof",
  title: "Device proof rejected",
  status: 400,
  detail
});

export const createTokenReuseProblem = (detail: string): Problem => ({
  type: "https://errors.lokaltreu.dev/replay",
  title: "Token replay detected",
  status: 409,
  detail
});

// akzeptiert alte Aufrufe mit mehr Parametern, letztes arg als detail wenn string
export const createInternalServerErrorProblem = (...args: unknown[]): Problem => {
  const detail = typeof args[args.length - 1] === "string" ? (args[args.length - 1] as string) : undefined;
  return { type: "about:blank", title: "Internal Server Error", status: 500, detail };
};

export const SECURE_DEVICE_OK_RESPONSE = { ok: true } as const;
export const SECURE_ACTION_OK_RESPONSE = { ok: true } as const;

