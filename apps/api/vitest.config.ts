import { defineConfig } from "vitest/config";

const coverageEnabled = process.env.VITEST_COVERAGE !== "false";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    reporters: ["default"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      enabled: coverageEnabled,
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      exclude: ["dist/**", "runtime/contracts.*", "test-utils/**"]
    }
  },
});
