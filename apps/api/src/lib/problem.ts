import { problem as throwProblem, type Problem } from '@lokaltreu/config';

export type ProblemDocument = Problem;

export const problem = throwProblem;

export function asProblem<T extends { status: number; title?: string; type?: string }>(
  doc: T,
): Problem & T {
  return {
    type: doc.type ?? 'about:blank',
    title: doc.title ?? 'Problem',
    ...doc,
    status: doc.status,
  } as Problem & T;
}
