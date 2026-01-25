import type { Problem } from "../problem";

const defaultMessage = "Unbekannter Fehler. Bitte erneut versuchen.";

const messageByErrorCode: Record<string, (problem: Problem) => string> = {
  TOKEN_EXPIRED: () => "Code ist abgelaufen. Bitte neuen Code erzeugen.",
  TOKEN_REUSE: () => "Code wurde bereits verwendet. Bitte neuen Code scannen.",
  PLAN_NOT_ALLOWED: () =>
    "Diese Funktion ist in deinem Plan nicht verfuegbar. Bitte Inhaber kontaktieren.",
  RATE_LIMITED: (problem) => {
    if (typeof problem.retry_after === "number" && Number.isFinite(problem.retry_after)) {
      return `Zu viele Versuche. Bitte ${problem.retry_after}s warten und erneut versuchen.`;
    }
    return "Zu viele Versuche. Bitte kurz warten und erneut versuchen.";
  },
};

export function toStaffUserMessage(problem: Problem): string {
  if (
    problem.status === 503 &&
    (problem.title === "Network error" ||
      problem.detail === "Service not reachable. Please try again.")
  ) {
    const message = "Service nicht erreichbar. Bitte Prism/Backend starten und erneut versuchen.";
    return problem.correlation_id ? `${message} Support-Code: ${problem.correlation_id}` : message;
  }

  const resolver = problem.error_code ? messageByErrorCode[problem.error_code] : undefined;
  const baseMessage = resolver ? resolver(problem) : problem.title || defaultMessage;

  if (problem.correlation_id) {
    return `${baseMessage} Support-Code: ${problem.correlation_id}`;
  }

  return baseMessage;
}
