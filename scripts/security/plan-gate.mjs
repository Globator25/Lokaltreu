#!/usr/bin/env node

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const STARTER_TOKEN = process.env.STARTER_TOKEN ?? '';
const endpointPath = '/referrals/link';

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const defaultAuth = toBearer(AUTH_TOKEN) ?? toBearer(STARTER_TOKEN);

async function fetchTenant(tenant) {
  const url = new URL(endpointPath, API_BASE);
  if (tenant) {
    url.searchParams.set('tenant', tenant);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (tenant === 'starter' && toBearer(STARTER_TOKEN)) {
    headers.Authorization = toBearer(STARTER_TOKEN);
  } else if (defaultAuth) {
    headers.Authorization = defaultAuth;
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
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
    throw new Error(`Failed to call ${url.toString()}: ${error.message}`);
  }
}

async function main() {
  console.log(`[plan-gate] Target ${new URL(endpointPath, API_BASE).toString()}`);
  const starter = await fetchTenant('starter');
  if (starter.status !== 403 || (starter.json?.type ?? '') !== 'PLAN_NOT_ALLOWED') {
    throw new Error(`Starter expected 403 PLAN_NOT_ALLOWED but received ${starter.status} ${starter.json?.type ?? 'UNKNOWN'}`);
  }
  console.log('[plan-gate] Starter blocked with PLAN_NOT_ALLOWED');
  for (const tenant of ['plus', 'premium']) {
    const result = await fetchTenant(tenant);
    if (result.status !== 200) {
      const type = result.json?.type ?? 'UNKNOWN';
      throw new Error(`${tenant} expected 200 but received ${result.status} (${type})`);
    }
    if (typeof result.json?.url !== 'string') {
      throw new Error(`${tenant} response missing referral url`);
    }
    console.log(`[plan-gate] ${tenant} received ${result.json.url}`);
  }
}

main().catch((error) => {
  console.error('[plan-gate] FAILED', error.message);
  process.exitCode = 1;
});

