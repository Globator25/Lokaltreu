// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyFromQuery,
  getOrCreateCardId,
  getOrCreateTenantId,
  isUuid,
} from "./pwa-context";

const tenantKey = "lt_tenant_id";
const cardKey = "lt_card_id";
const refKey = "lt_ref";

const validTenant = "11111111-1111-4111-8111-111111111111";
const validCard = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pwa-context", () => {
  it("getOrCreateTenantId generates and persists a UUID", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => validTenant),
    });

    const first = getOrCreateTenantId();
    const second = getOrCreateTenantId();

    expect(isUuid(first)).toBe(true);
    expect(first).toBe(validTenant);
    expect(second).toBe(validTenant);
    expect(localStorage.getItem(tenantKey)).toBe(validTenant);
  });

  it("getOrCreateCardId generates and persists a UUID", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => validCard),
    });

    const first = getOrCreateCardId();
    const second = getOrCreateCardId();

    expect(isUuid(first)).toBe(true);
    expect(first).toBe(validCard);
    expect(second).toBe(validCard);
    expect(localStorage.getItem(cardKey)).toBe(validCard);
  });

  it("applyFromQuery accepts valid UUIDs and ignores invalid values", () => {
    localStorage.setItem(tenantKey, validTenant);
    localStorage.setItem(cardKey, validCard);

    const params = new URLSearchParams({
      tenant: "not-a-uuid",
      card: "also-not-a-uuid",
      ref: "share-me",
    });

    applyFromQuery(params);

    expect(localStorage.getItem(tenantKey)).toBe(validTenant);
    expect(localStorage.getItem(cardKey)).toBe(validCard);
    expect(localStorage.getItem(refKey)).toBe("share-me");
  });

  it("applyFromQuery updates stored UUIDs when valid", () => {
    const newTenant = "33333333-3333-4333-8333-333333333333";
    const newCard = "44444444-4444-4444-8444-444444444444";

    const params = new URLSearchParams({
      tenant: newTenant,
      card: newCard,
    });

    applyFromQuery(params);

    expect(localStorage.getItem(tenantKey)).toBe(newTenant);
    expect(localStorage.getItem(cardKey)).toBe(newCard);
  });
});

