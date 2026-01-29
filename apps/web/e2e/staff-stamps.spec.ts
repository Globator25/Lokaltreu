import { test, expect } from "@playwright/test";

test.describe("Staff stamps (US-8)", () => {
  test("creates a stamp token", async ({ page }) => {
    await page.goto("/staff/stamps");

    await page.getByTestId("staff-stamps-device-key").fill("device-key-test");
    await page.getByTestId("staff-stamps-device-timestamp").fill("1700000000");
    await page.getByTestId("staff-stamps-device-proof").fill("proof-test");
    await page.getByTestId("staff-stamps-submit").click();

    const payload = page.getByTestId("staff-stamps-payload");
    await expect(payload).toBeVisible({ timeout: 10000 });
    await expect(payload).toContainText("qrToken");
  });
});
