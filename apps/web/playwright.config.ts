import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const basePort = (() => {
  try {
    return new URL(baseURL).port || "3000";
  } catch {
    return "3000";
  }
})();
const devPort = process.env.PORT ?? basePort;

export default defineConfig({
  testDir: "./e2e",
  retries: isCi ? 1 : 0,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      PORT: devPort,
    },
  },
});
