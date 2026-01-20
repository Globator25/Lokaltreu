"use client";

export type Problem = {
  status: number;
  title: string;
  detail?: string;
  error_code?: string;
  correlation_id?: string;
  retry_after?: number;
};

type ProblemInput = Partial<Record<keyof Problem, unknown>>;

const defaultTitle = "Request failed";

function toStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toNumberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseProblem(input: unknown, fallbackStatus = 500): Problem {
  const data = (input && typeof input === "object" ? input : {}) as ProblemInput;

  const status = toNumberField(data.status) ?? fallbackStatus;
  const title = toStringField(data.title) ?? defaultTitle;
  const detail = toStringField(data.detail);
  const error_code = toStringField(data.error_code);
  const correlation_id = toStringField(data.correlation_id);
  const retry_after = toNumberField(data.retry_after);

  return {
    status,
    title,
    detail,
    error_code,
    correlation_id,
    retry_after,
  };
}

const messageByErrorCode: Record<string, string> = {
  TOKEN_EXPIRED: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden.",
  TOKEN_REUSE: "Der Link wurde bereits verwendet. Bitte einen neuen Link erzeugen.",
  PLAN_NOT_ALLOWED: "Diese Funktion ist in deinem Plan nicht verfuegbar.",
  RATE_LIMITED: "Zu viele Anfragen. Bitte spaeter erneut versuchen.",
};

export function toUserMessage(problem: Problem): string {
  const baseMessage =
    (problem.error_code && messageByErrorCode[problem.error_code]) ??
    "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.";

  if (problem.correlation_id) {
    return `${baseMessage} Support-Code: ${problem.correlation_id}`;
  }

  return baseMessage;
}
