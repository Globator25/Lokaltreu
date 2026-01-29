import type { Page } from "@playwright/test";

export const TEST_TENANT_ID = "11111111-2222-4333-8888-111111111111";
export const TEST_CARD_ID = "22222222-3333-4333-8888-222222222222";
export const TEST_ADMIN_BEARER = "Bearer e2e-admin-token";

export async function seedPwaContext(page: Page): Promise<void> {
  await page.addInitScript(
    ({ tenantId, cardId }) => {
      window.localStorage.setItem("lt_tenant_id", tenantId);
      window.localStorage.setItem("lt_card_id", cardId);
    },
    { tenantId: TEST_TENANT_ID, cardId: TEST_CARD_ID },
  );
}

export async function withAdminAuth(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    Authorization: TEST_ADMIN_BEARER,
  });
}
