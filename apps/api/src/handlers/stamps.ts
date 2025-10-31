import type { paths } from '@lokaltreu/types';
import { requireIdempotency } from '../mw/idempotency';
type Req = paths['/stamps/claim']['post']['requestBody']['content']['application/json'];
type Res = paths['/stamps/claim']['post']['responses']['201']['content']['application/json'];
export async function claim(req: Request, tenantId: string): Promise<Response> {
  await requireIdempotency(req, tenantId, '/stamps/claim');
  const _payload = await req.json() as Req;
  const body: Res = { cardState: { /* state */ } };
  return new Response(JSON.stringify(body), { status: 201, headers: { 'content-type':'application/json' }});
}
