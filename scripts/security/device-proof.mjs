#!/usr/bin/env node

import crypto from 'node:crypto';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const DEVICE_ID = process.env.DEVICE_ID ?? 'demo-device';
const endpointPath = '/secure-device';
const endpoint = new URL(endpointPath, API_BASE).toString();

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const AUTH_HEADER = toBearer(AUTH_TOKEN);

export function loadSigningKey() {
  const raw = process.env.DP_PRIV ?? '';
  if (!raw.trim()) {
    throw new Error('DP_PRIV is empty');
  }
  try {
    return crypto.createPrivateKey({ key: raw, format: 'pem' });
  } catch (error) {
    throw new Error(`Unable to load DP_PRIV: ${error.message}`);
  }
}

const signingKey = loadSigningKey();

async function send(headers) {
  const merged = { ...headers };
  if (AUTH_HEADER && !merged.Authorization) {
    merged.Authorization = AUTH_HEADER;
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: merged,
      body: JSON.stringify({ check: 'device-proof' }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        json = { parseError: error.message, raw: text };
      }
    }
    return { status: response.status, json };
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}

function buildProofHeaders(timestamp = Date.now()) {
  const jti = crypto.randomUUID();
  const payload = Buffer.from(`POST|${endpointPath}|${timestamp}|${jti}`);
  const signature = crypto.sign(null, payload, signingKey).toString('base64');
  return {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    'X-Device-Timestamp': String(timestamp),
    'X-Device-Jti': jti,
    'X-Device-Proof': signature,
  };
}

async function expectProblem(label, headers, expectedStatus, expectedType) {
  const result = await send(headers);
  if (result.status !== expectedStatus) {
    throw new Error(`${label}: expected status ${expectedStatus} but received ${result.status}`);
  }
  const actualType = result.json?.type ?? 'UNKNOWN';
  if (expectedType && actualType !== expectedType) {
    throw new Error(`${label}: expected type ${expectedType} but received ${actualType}`);
  }
  console.log(`[device-proof] ${label} -> ${result.status} (${actualType})`);
}

async function expectSuccess(label, headers) {
  const result = await send(headers);
  if (result.status !== 200) {
    const type = result.json?.type ?? 'UNKNOWN';
    throw new Error(`${label}: expected 200 but received ${result.status} (${type})`);
  }
  if (result.json?.ok !== true) {
    throw new Error(`${label}: response missing ok:true flag`);
  }
  console.log(`[device-proof] ${label} -> 200 OK`);
}

async function main() {
  console.log(`[device-proof] Target ${endpoint} using device ${DEVICE_ID}`);
  await expectProblem('missing proof', { 'Content-Type': 'application/json' }, 401, 'DEVICE_PROOF_REQUIRED');
  const past = Date.now() - 120000;
  await expectProblem('stale timestamp', buildProofHeaders(past), 403, 'DEVICE_PROOF_INVALID_TIME');
  await expectSuccess('valid proof', buildProofHeaders());
}

main().catch((error) => {
  console.error('[device-proof] FAILED', error.message);
  process.exitCode = 1;
});
