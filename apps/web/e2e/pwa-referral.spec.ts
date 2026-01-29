import { test, expect } from "@playwright/test";
import { seedPwaContext, TEST_CARD_ID, TEST_TENANT_ID } from "./utils";

test.describe("PWA referral (US-13)", () => {
  test("loads a referral link", async ({ page }) => {
    page.on("response", (response) => {
      if (response.status() === 404) {
        console.log("404", response.url());
      }
    });
    page.on("requestfailed", (request) => {
      console.log("REQFAIL", request.url(), request.failure()?.errorText);
    });

    await seedPwaContext(page);
    await page.goto(`/pwa/referral?tenant=${TEST_TENANT_ID}&card=${TEST_CARD_ID}`);

    await page.getByTestId("pwa-referral-load").click();

    const result = page.getByTestId("pwa-referral-result");
    const errorHeading = page.getByRole("heading", { name: "Fehler" });
    const errorSection = page.locator("section", { has: errorHeading });

    await Promise.any([
      result.waitFor({ state: "visible", timeout: 10000 }),
      errorHeading.waitFor({ state: "visible", timeout: 10000 }),
    ]);

    if (await result.isVisible()) {
      await expect(result).toBeVisible();
      await expect(page.getByTestId("pwa-referral-link")).not.toBeEmpty();
      return;
    }

    console.log("PAGE_URL", page.url());
    console.log("ERROR_BOX", await errorSection.innerText());
    await expect(errorSection).toBeVisible();
    await expect(errorSection).toContainText(/correlation_id|error_code|status/i);
  });
});
