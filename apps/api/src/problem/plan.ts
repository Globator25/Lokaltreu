import type { ProblemDetails } from "../handlers/http-utils.js";

type PlanErrorCode = "PLAN_NOT_ALLOWED";

export type PlanProblem = ProblemDetails & {
  status: 403;
  error_code: PlanErrorCode;
  correlation_id: string;
};

export const PLAN_NOT_ALLOWED_TYPE = "https://errors.lokaltreu.example/plan/not-allowed";
export const PLAN_NOT_ALLOWED_TITLE = "Plan not allowed";
export const PLAN_NOT_ALLOWED_CODE: PlanErrorCode = "PLAN_NOT_ALLOWED";
export const PLAN_NOT_ALLOWED_ERROR = "PLAN_NOT_ALLOWED";

export function isPlanNotAllowedError(error: unknown): error is Error {
  return error instanceof Error && error.message === PLAN_NOT_ALLOWED_ERROR;
}

export function makePlanNotAllowedProblem(params: {
  correlationId: string;
  detail?: string;
  instance?: string;
}): PlanProblem {
  return {
    type: PLAN_NOT_ALLOWED_TYPE,
    title: PLAN_NOT_ALLOWED_TITLE,
    status: 403,
    detail: params.detail,
    instance: params.instance,
    error_code: PLAN_NOT_ALLOWED_CODE,
    correlation_id: params.correlationId,
  };
}
