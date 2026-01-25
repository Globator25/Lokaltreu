import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const enableWebServer = Boolean(process.env.E2E_WEB_SERVER);

export default defineConfig({
  testDir: "./e2e",
  retries: isCi ? 1 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: enableWebServer
    ? {
        command: "npm -w apps/web run dev",
        url: baseURL,
        reuseExistingServer: !isCi,
      }
    : undefined,
});
