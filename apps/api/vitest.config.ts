import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],

    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)", "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules/**", "dist/**"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],

      // API relativ zu apps/api
      include: ["src/**/*.ts", "tests/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.{test,spec}.?(c|m)[jt]s?(x)",
        "**/*.http.spec.*",
        "dist/**",
        "node_modules/**",
        "scripts/**",
        "tools/**",
        "artifacts/**",
        "src/dev/**",
        "src/dev-*.ts",
        "src/server-main.ts"
      ]
    }
  }
});
