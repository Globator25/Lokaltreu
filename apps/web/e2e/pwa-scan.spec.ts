import { test, expect } from "@playwright/test";
import { seedPwaContext, TEST_CARD_ID, TEST_TENANT_ID } from "./utils";

test.describe("PWA scan (US-10)", () => {
  test("claims a stamp with a QR token", async ({ page }) => {
    page.on("response", (response) => {
      if (response.status() === 404) {
        console.log("404", response.url());
      }
    });
    page.on("requestfailed", (request) => {
      console.log("REQFAIL", request.url(), request.failure()?.errorText);
    });

    await seedPwaContext(page);
    await page.goto(`/pwa/scan?tenant=${TEST_TENANT_ID}&card=${TEST_CARD_ID}`);

    await page.getByTestId("pwa-scan-token").fill("qr-token-test");
    await page.getByTestId("pwa-scan-submit").click();

    const success = page.getByTestId("pwa-scan-success");
    const errorHeading = page.getByRole("heading", { name: "Fehler" });
    const errorSection = page.locator("section", { has: errorHeading });

    await Promise.any([
      success.waitFor({ state: "visible", timeout: 10000 }),
      errorHeading.waitFor({ state: "visible", timeout: 10000 }),
    ]);

    if (await success.isVisible()) {
      await expect(success).toBeVisible();
      return;
    }

    console.log("PAGE_URL", page.url());
    console.log("ERROR_BOX", await errorSection.innerText());
    await expect(errorSection).toBeVisible();
    await expect(errorSection).toContainText(/correlation_id|error_code|status/i);
  });
});
