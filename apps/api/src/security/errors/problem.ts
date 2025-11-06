// RFC 7807 Problem Details Objekt
export interface ProblemDetails {
  type: string;    // maschinenlesbare URI, z.B. "https://lokaltreu/errors/unauthorized"
  title: string;   // kurzer Titel
  status: number;  // HTTP-Statuscode
  detail?: string; // menschenlesbare Detailinfo
  instance?: string; // optionale Request-/Trace-ID
  [key: string]: unknown;
}

// Hilfsfunktionen für Standardfehler laut SPEC (400/401/403/409/422/429).
export function unauthorized(detail = "Unauthorized"): ProblemDetails {
  return {
    type: "https://lokaltreu/errors/unauthorized",
    title: "Unauthorized",
    status: 401,
    detail
  };
}

export function forbidden(detail = "Forbidden"): ProblemDetails {
  return {
    type: "https://lokaltreu/errors/forbidden",
    title: "Forbidden",
    status: 403,
    detail
  };
}

export function tooManyRequests(detail = "Too Many Requests"): ProblemDetails {
  return {
    type: "https://lokaltreu/errors/rate-limit",
    title: "Too Many Requests",
    status: 429,
    detail
  };
}


