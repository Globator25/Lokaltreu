import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Monorepo-Projekte: explizit die Config-Dateien (deterministisch, keine Workspace-Discovery)
    projects: ["./apps/api/vitest.config.ts", "./apps/web/vitest.config.ts"],
  },
});
