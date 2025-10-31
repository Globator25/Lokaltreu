import crypto from 'node:crypto';
import * as nacl from 'tweetnacl';
import { problem } from './problem';
function b64urlToUint8(s:string){ s=s.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(Buffer.from(s,'base64')); }
export async function requireDeviceProof(req: Request, publicKeyB64u: string, jti: string) {
  const proof = req.headers.get('X-Device-Proof');
  const ts = req.headers.get('X-Device-Timestamp');
  if (!proof || !ts) throw problem({ type:'https://errors.lokaltreu.example/device/missing-proof', title:'Device proof required', status:401, error_code:'DEVICE_PROOF_MISSING', correlation_id: crypto.randomUUID() });
  const drift = Math.abs(Date.now() - Number(ts));
  if (drift > 30_000) throw problem({ type:'https://errors.lokaltreu.example/device/ts-skew', title:'Timestamp skew', status:403, error_code:'DEVICE_TS_SKEW', correlation_id: crypto.randomUUID() });
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const msg = new TextEncoder().encode(`${method}|${url.pathname}|${ts}|${jti}`);
  const ok = nacl.sign.detached.verify(msg, b64urlToUint8(proof), b64urlToUint8(publicKeyB64u));
  if (!ok) throw problem({ type:'https://errors.lokaltreu.example/device/invalid-proof', title:'Invalid device proof', status:403, error_code:'DEVICE_PROOF_INVALID', correlation_id: crypto.randomUUID() });
}
