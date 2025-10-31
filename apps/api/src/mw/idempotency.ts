import crypto from 'node:crypto';
import { problem } from './problem';
const redis = { async setNX(key:string, val:string, ttlSec:number){/* implement */} };
export async function requireIdempotency(req: Request, tenantId: string, route: string) {
  const key = req.headers.get('Idempotency-Key');
  if (!key) throw problem({ type:'https://errors.lokaltreu.example/headers/missing-idempotency', title:'Idempotency-Key required', status:400, error_code:'HEADERS_MISSING', correlation_id: crypto.randomUUID() });
  const body = await req.clone().text();
  const scope = `${tenantId}|${route}|${crypto.createHash('sha256').update(body).digest('hex')}`;
  const cacheKey = `idem:${scope}:${key}`;
  const ok = await redis.setNX(cacheKey, '1', 24*60*60);
  if (!ok) throw problem({ type:'https://errors.lokaltreu.example/idempotency/replay', title:'Duplicate request', status:409, error_code:'IDEMPOTENT_REPLAY', correlation_id: crypto.randomUUID() });
}
