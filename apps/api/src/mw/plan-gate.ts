import crypto from 'node:crypto';
import { problem } from './problem';
type Plan = 'Starter'|'Plus'|'Premium';
export function requirePlan(feature:'referral') {
  return async (tenantPlan: Plan) => {
    if (feature === 'referral' && tenantPlan === 'Starter') {
      throw problem({ type:'https://errors.lokaltreu.example/plan/not-allowed', title:'Plan not allowed', status:403, error_code:'PLAN_NOT_ALLOWED', correlation_id: crypto.randomUUID() });
    }
  };
}
