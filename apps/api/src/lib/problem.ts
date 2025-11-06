import type { ProblemJson } from "@lokaltreu/types";

type ErrorCode = ProblemJson["error_code"];

export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  error_code: ErrorCode;
  correlation_id: string;
  detail?: string;
  instance?: string;
}

export const problem = (p: ProblemDocument): Response =>
  new Response(JSON.stringify(p), {
    status: p.status,
    headers: { "content-type": "application/problem+json" },
  });
