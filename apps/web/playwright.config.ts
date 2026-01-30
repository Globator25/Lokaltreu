import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const basePort = (() => {
  try {
    return new URL(baseURL).port || "3000";
  } catch {
    return "3000";
  }
})();
const devPort = process.env.PORT ?? basePort;
const useExternalWebServer = process.env.E2E_EXTERNAL_WEBSERVER === "1";
const runnerOwnsWebServer = process.env.E2E_RUNNER_OWNS_WEBSERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  retries: isCi ? 1 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  // E2E_EXTERNAL_WEBSERVER=1 or E2E_RUNNER_OWNS_WEBSERVER=1 disables Playwright-managed webServer.
  webServer: useExternalWebServer || runnerOwnsWebServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !isCi,
        timeout: 120000,
        env: {
          ...process.env,
          PORT: devPort,
        },
      },
});
