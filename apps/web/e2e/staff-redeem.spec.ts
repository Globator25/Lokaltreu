import { test, expect } from "@playwright/test";

test.describe("Staff redeem (US-9)", () => {
  test("redeems a reward", async ({ page }) => {
    await page.goto("/staff/redeem");

    await page.getByTestId("staff-redeem-token").fill("redeem-token-test");
    await page.getByTestId("staff-redeem-device-key").fill("device-key-test");
    await page.getByTestId("staff-redeem-device-timestamp").fill("1700000000");
    await page.getByTestId("staff-redeem-device-proof").fill("proof-test");
    await page.getByTestId("staff-redeem-submit").click();

    const payload = page.getByTestId("staff-redeem-payload");
    await expect(payload).toBeVisible({ timeout: 10000 });
    await expect(payload).toContainText("cardState");
  });
});
