export interface Problem {
  type: string;
  title: string;
  status: number;
  error_code?: string;
  correlation_id?: string;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}
export function problem(status: number, title: string, detail?: string, error_code?: string): never;
export function problem(doc: Problem): never;
export declare const RETENTION_DAYS: 180;
