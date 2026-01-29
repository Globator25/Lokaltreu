import { test, expect } from "@playwright/test";
import { withAdminAuth } from "./utils";

test.describe("Admin devices (US-2)", () => {
  test("generates a device registration link", async ({ page }) => {
    await withAdminAuth(page);
    await page.goto("/admin/devices");

    await page.getByTestId("device-invite-open").click();
    await expect(page.getByTestId("device-invite-modal")).toBeVisible();

    await page.getByTestId("device-invite-generate").click();
    await expect(page.getByTestId("device-invite-link")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("device-invite-link")).not.toBeEmpty();
  });
});
