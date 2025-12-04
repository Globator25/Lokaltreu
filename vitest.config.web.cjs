const path = require("node:path");
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  root: path.resolve(__dirname, "apps/web"),
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["vitest.setup.ts"],      // relativ zu apps/web
    include: ["src/**/*.spec.{ts,tsx}"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/node_modules/**","**/dist/**","**/coverage/**","**/*.d.ts"],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
  esbuild: { jsx: "automatic" },
});
