import { test, expect } from "@playwright/test";
import { seedPwaContext, TEST_CARD_ID } from "./utils";

test.describe("PWA DSR", () => {
  test("create DSR request and then load status", async ({ page }) => {
    await seedPwaContext(page);
    await page.goto("/pwa/dsr");

    await expect(page.getByTestId("dsr-card-id")).toBeVisible();
    await page.getByTestId("dsr-card-id").fill(TEST_CARD_ID);

    const submit = page.getByTestId("dsr-submit");
    await expect(submit).toBeEnabled({ timeout: 10000 });
    await submit.click();

    await expect(page.getByTestId("dsr-confirmation")).toBeVisible({ timeout: 10000 });

    const requestId = (await page.getByTestId("dsr-request-id").innerText()).trim();
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    await page.getByTestId("dsr-status-request-id").fill(requestId);
    await page.getByTestId("dsr-status-submit").click();

    await expect(page.getByTestId("dsr-status-result")).toBeVisible({ timeout: 10000 });
  });
});
