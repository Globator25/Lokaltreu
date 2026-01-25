"use client";

const TENANT_KEY = "lt_tenant_id";
const CARD_KEY = "lt_card_id";
const REF_KEY = "lt_ref";

// Module-scoped fallback for environments without localStorage (SSR, strict privacy mode).
const memoryStore: Record<string, string | undefined> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors and fall back to memoryStore.
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Ignore storage access errors and fall back to memoryStore.
  }
  memoryStore[key] = value;
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: not cryptographically strong, but acceptable as last resort for client-side IDs.
  return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isUuid(value: string): boolean {
  const raw = value.trim().toLowerCase();
  if (!raw) return false;

  const withoutPrefix = raw.startsWith("urn:uuid:") ? raw.slice("urn:uuid:".length) : raw;
  const withoutBraces =
    withoutPrefix.startsWith("{") && withoutPrefix.endsWith("}")
      ? withoutPrefix.slice(1, -1)
      : withoutPrefix;

  // Accept UUIDs of any version, but enforce the RFC4122 variant bits.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    withoutBraces,
  );
}

export function getOrCreateTenantId(): string {
  const existing = safeGetItem(TENANT_KEY);
  if (existing && isUuid(existing)) return existing;

  const created = newUuid();
  safeSetItem(TENANT_KEY, created);
  return created;
}

export function getOrCreateCardId(): string {
  const existing = safeGetItem(CARD_KEY);
  if (existing && isUuid(existing)) return existing;

  const created = newUuid();
  safeSetItem(CARD_KEY, created);
  return created;
}

export function applyFromQuery(searchParams: URLSearchParams): void {
  const tenant = searchParams.get("tenant");
  if (tenant && isUuid(tenant)) {
    safeSetItem(TENANT_KEY, tenant);
  }

  const card = searchParams.get("card");
  if (card && isUuid(card)) {
    safeSetItem(CARD_KEY, card);
  }

  const ref = searchParams.get("ref");
  if (ref) {
    safeSetItem(REF_KEY, ref);
  }
}

export function getTenantId(): string {
  return getOrCreateTenantId();
}

export function getCardId(): string {
  return getOrCreateCardId();
}
