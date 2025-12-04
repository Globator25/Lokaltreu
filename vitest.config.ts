import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CoverageOptions } from "vitest";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Zentrale Coverage-Konfiguration (gilt für alle Projekte)
const coverageConfig: CoverageOptions = {
  provider: "v8",
  all: true,
  reporter: ["text", "lcov", "html"],
  reportsDirectory: path.resolve(__dirname, "coverage"),
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.d.ts",
  ],
  include: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
};

export default defineConfig({
  resolve: {
    alias: {
      "@apps": path.resolve(__dirname, "apps"),
      "@apps/api": path.resolve(__dirname, "apps/api/src"),
      "@apps/web": path.resolve(__dirname, "apps/web/src"),
      "@packages": path.resolve(__dirname, "packages"),
      "@packages/types": path.resolve(__dirname, "packages/types/src"),
    },
  },
  test: {
    globals: true,

    // erzeugt zwar eine Deprecation-Warnung, funktioniert aber technisch
    cache: {
      dir: path.resolve(__dirname, "node_modules/.vitest"),
    },

    // Coverage nur auf Root-Ebene erlaubt
    coverage: coverageConfig,

    reporters: process.env.CI
      ? [
          "default",
          [
            "junit",
            { outputFile: "test-results/root/vitest-junit.xml" },
          ],
        ]
      : "default",

    // Drei Projekte im Monorepo: API, Web, Packages
    projects: [
      // API-Projekt
      {
        test: {
          name: "api",
          root: path.resolve(__dirname, "apps/api"),
          environment: "node",
          include: ["src/**/*.{spec,test}.ts"],
        },
      },

      // Web-Projekt (Next.js + React)
      {
        test: {
          name: "web",
          root: path.resolve(__dirname, "apps/web"),
          environment: "jsdom",
          // falls vorhanden: apps/web/vitest.setup.ts
          setupFiles: ["vitest.setup.ts"],
          include: ["src/**/*.{spec,test}.{ts,tsx}"],
        },
      },

      // Packages (z. B. @lokaltreu/types)
      {
        test: {
          name: "packages",
          root: path.resolve(__dirname, "packages"),
          environment: "node",
          include: ["**/*.{spec,test}.{ts,tsx}"],
        },
      },
    ],
  },
});
