"use client";

import type { components } from "@lokaltreu/types";

export type Problem = components["schemas"]["Problem"];

type ProblemErrorCode = NonNullable<Problem["error_code"]>;
type Step36ErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_REUSE"
  | "SELF_REFERRAL_BLOCKED"
  | "REFERRAL_LIMIT_REACHED"
  | "REFERRAL_TENANT_MISMATCH"
  | "PLAN_NOT_ALLOWED"
  | "RATE_LIMITED";

export type UiProblemSeverity = "error" | "warning" | "info";

export type UiProblemMessage = {
  title: string;
  message: string;
  severity: UiProblemSeverity;
  retryAfterSeconds?: number;
  supportCode?: string;
};

type ProblemInput = Partial<Record<keyof Problem, unknown>>;

const defaultTitle = "Request failed";
export const defaultProblemType: Problem["type"] = "about:blank";

function toStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toNumberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toProblemErrorCode(value: unknown): ProblemErrorCode | undefined {
  const errorCode = toStringField(value) as ProblemErrorCode | undefined;
  return errorCode;
}

export function parseProblem(input: unknown, fallbackStatus = 500): Problem {
  const data = (input && typeof input === "object" ? input : {}) as ProblemInput;

  const type = toStringField(data.type) ?? defaultProblemType;
  const status = toNumberField(data.status) ?? fallbackStatus;
  const title = toStringField(data.title) ?? defaultTitle;
  const detail = toStringField(data.detail);
  const error_code = toProblemErrorCode(data.error_code);
  const correlation_id = toStringField(data.correlation_id);
  const retry_after = toNumberField(data.retry_after);

  return {
    type,
    status,
    title,
    detail,
    error_code,
    correlation_id,
    retry_after,
  };
}

type UiMessageTemplate = {
  title: string;
  message: string;
  severity: UiProblemSeverity;
};

const step36MessageByErrorCode = {
  TOKEN_EXPIRED: {
    title: "Session expired",
    message: "Your session has expired. Please sign in again.",
    severity: "warning",
  },
  TOKEN_REUSE: {
    title: "Link already used",
    message: "This link has already been used. Please request a new one.",
    severity: "warning",
  },
  SELF_REFERRAL_BLOCKED: {
    title: "Referral not allowed",
    message: "Self referrals are not allowed.",
    severity: "warning",
  },
  REFERRAL_LIMIT_REACHED: {
    title: "Referral limit reached",
    message: "The referral limit has been reached for this period.",
    severity: "warning",
  },
  REFERRAL_TENANT_MISMATCH: {
    title: "Referral not valid here",
    message: "This referral code does not belong to this tenant.",
    severity: "error",
  },
  PLAN_NOT_ALLOWED: {
    title: "Plan not allowed",
    message: "This feature is not available on your current plan.",
    severity: "warning",
  },
  RATE_LIMITED: {
    title: "Too many requests",
    message: "Too many requests. Please try again shortly.",
    severity: "warning",
  },
} satisfies Record<Step36ErrorCode, UiMessageTemplate>;

const statusFallbackByCode: Record<number, UiMessageTemplate> = {
  400: {
    title: "Bad request",
    message: "The request could not be processed. Please try again.",
    severity: "error",
  },
  401: {
    title: "Unauthorized",
    message: "You are not authorized. Please sign in and try again.",
    severity: "warning",
  },
  403: {
    title: "Forbidden",
    message: "This action is not allowed.",
    severity: "warning",
  },
  404: {
    title: "Not found",
    message: "The requested resource was not found.",
    severity: "error",
  },
  409: {
    title: "Conflict",
    message: "The request could not be completed due to a conflict.",
    severity: "error",
  },
  422: {
    title: "Unprocessable request",
    message: "The request was valid but could not be processed.",
    severity: "error",
  },
  429: {
    title: "Too many requests",
    message: "Too many requests. Please try again shortly.",
    severity: "warning",
  },
  500: {
    title: "Server error",
    message: "An unexpected error occurred. Please try again.",
    severity: "error",
  },
  503: {
    title: "Service unavailable",
    message: "The service is temporarily unavailable. Please try again.",
    severity: "error",
  },
};

const defaultFallbackMessage: UiMessageTemplate = {
  title: "Request failed",
  message: "An unexpected error occurred. Please try again.",
  severity: "error",
};

function resolveStatusFallback(status: number): UiMessageTemplate {
  if (statusFallbackByCode[status]) {
    return statusFallbackByCode[status];
  }

  if (status >= 400 && status < 500) {
    return {
      title: statusFallbackByCode[400].title,
      message: statusFallbackByCode[400].message,
      severity: statusFallbackByCode[400].severity,
    };
  }

  if (status >= 500) {
    return {
      title: statusFallbackByCode[500].title,
      message: statusFallbackByCode[500].message,
      severity: statusFallbackByCode[500].severity,
    };
  }

  return defaultFallbackMessage;
}

export function toUiProblemMessage(problem: Problem): UiProblemMessage {
  const mappedByErrorCode =
    problem.error_code && step36MessageByErrorCode[problem.error_code as Step36ErrorCode];

  const base = mappedByErrorCode ?? resolveStatusFallback(problem.status);

  const retryAfterSeconds =
    problem.error_code === "RATE_LIMITED"
      ? toNumberField(problem.retry_after)
      : undefined;

  const supportCode = toStringField(problem.correlation_id);

  return {
    title: base.title,
    message: base.message,
    severity: base.severity,
    retryAfterSeconds,
    supportCode,
  };
}

export function toUserMessage(problem: Problem): string {
  const uiMessage = toUiProblemMessage(problem);
  const supportSuffix = uiMessage.supportCode ? ` Support-Code: ${uiMessage.supportCode}` : "";
  const retrySuffix =
    uiMessage.retryAfterSeconds && uiMessage.retryAfterSeconds > 0
      ? ` Retry after: ${uiMessage.retryAfterSeconds}s.`
      : "";

  return `${uiMessage.message}${retrySuffix}${supportSuffix}`;
}
