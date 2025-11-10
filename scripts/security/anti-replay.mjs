#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? process.env.STARTER_TOKEN ?? '';
const REQUESTS = 10;
const endpoint = new URL('/stamps/claim', API_BASE).toString();
const idemKey = process.env.TEST_IDEMPOTENCY_KEY ?? randomUUID();
const body = JSON.stringify({ source: 'security-gates' });

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const AUTH_HEADER = toBearer(AUTH_TOKEN);

function headers() {
  const next = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idemKey,
  };
  if (AUTH_HEADER) {
    next.Authorization = AUTH_HEADER;
  }
  return next;
}

async function fire(index) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers(),
      body,
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
    return { index, status: response.status, json };
  } catch (error) {
    return { index, error };
  }
}

async function main() {
  console.log(`[anti-replay] Target ${endpoint} using key ${idemKey}`);
  const results = await Promise.all(Array.from({ length: REQUESTS }, (_, idx) => fire(idx)));
  const failures = results.filter((entry) => entry.error);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`[anti-replay] Request #${failure.index} failed: ${failure.error.message}`));
    throw new Error('Some requests failed before receiving a response');
  }
  const created = results.filter((entry) => entry.status === 201);
  const conflicts = results.filter((entry) => entry.status === 409);
  if (created.length !== 1) {
    throw new Error(`Expected exactly one 201 but received ${created.length}`);
  }
  if (conflicts.length !== REQUESTS - 1) {
    throw new Error(`Expected ${REQUESTS - 1} conflicts but received ${conflicts.length}`);
  }
  if (created[0].json?.ok !== true) {
    throw new Error(`Unexpected body for 201 response: ${JSON.stringify(created[0].json)}`);
  }
  const invalidConflicts = conflicts.filter((entry) => (entry.json?.type ?? '') !== 'TOKEN_REUSE');
  if (invalidConflicts.length > 0) {
    throw new Error('One or more conflict responses were missing the TOKEN_REUSE type');
  }
  console.log('[anti-replay] Passed with 1x201 and 9x409 TOKEN_REUSE responses');
}

main().catch((error) => {
  console.error('[anti-replay] FAILED', error.message);
  process.exitCode = 1;
});

