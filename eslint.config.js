// @ts-check

import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

/**
 * ESLint Flat Configuration
 * @see https://eslint.org/docs/latest/use/configure/configuration-files-new
 */
export default tseslint.config(
  // Globale Ignores
  {
    ignores: ["**/node_modules/", "**/dist/", "apps/web/.next/", "**/coverage/"],
  },

  // 1. Basis-Konfiguration für das gesamte Repository (JavaScript)
  eslint.configs.recommended,

  // 2. TypeScript-Konfiguration für das gesamte Repository
  // Wendet typsichere Regeln auf alle .ts/.tsx-Dateien an und konfiguriert den Parser.
  ...tseslint.config({
    files: ["**/*.{ts,tsx}"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: true,
        // Wichtig: Setzt das Stammverzeichnis für die tsconfig-Suche, um Monorepos zu unterstützen.
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }),

  // 3. Spezifische Konfiguration für die Next.js Web-App
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    plugins: { "@next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Deaktiviert eine Regel, die in JS-Konfigurationsdateien (z.B. next.config.js) stören kann.
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // 4. Spezifische Konfiguration für die Node.js API
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      // Erlaube `require` in der API, falls für CommonJS-Interop benötigt.
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // 5. Globale Regelanpassungen für das gesamte Projekt
  { rules: { "no-console": ["warn", { allow: ["warn", "error"] }] } },
);