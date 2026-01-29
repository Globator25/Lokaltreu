import { test, expect } from "@playwright/test";

test.describe("Admin onboarding (US-1)", () => {
  test("registers admin and reaches campaign step", async ({ page }) => {
    await page.goto("/onboarding");

    await page.getByTestId("onboarding-email").fill("admin-test@example.com");
    await page.getByTestId("onboarding-password").fill("supersecurepass");
    await page.getByTestId("onboarding-next").click();

    const registration = page.getByTestId("onboarding-registration");
    await expect(registration).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("onboarding-admin-id")).not.toBeEmpty();
    await expect(page.getByTestId("onboarding-tenant-id")).not.toBeEmpty();

    await page.getByTestId("onboarding-next").click();
    await expect(page.getByRole("heading", { name: "Erste Kampagne" })).toBeVisible();
  });
});
