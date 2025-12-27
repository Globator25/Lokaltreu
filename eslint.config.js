// @ts-check

import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const nextRules = /** @type {import("eslint").Linter.RulesRecord} */ ({
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs["core-web-vitals"].rules,
  "@typescript-eslint/no-var-requires": "off",
});

/**
 * ESLint Flat Configuration
 * @see https://eslint.org/docs/latest/use/configure/configuration-files-new
 */
export default tseslint.config(
  //
  // 🔹 Globale Ignores
  //
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/lcov-report/**",
      "**/.next/**",
      "**/out/**",
      "**/.turbo/**",
      "**/.cache/**",
      "apps/api/src/**/*.js",
      "apps/api/vitest.setup.d.ts"
    ],
  },

  //
  // 🔹 1. Basis-Konfiguration (JS)
  //
  eslint.configs.recommended,

  //
  // 🔹 2. TypeScript-Konfiguration (typsicher, global)
  //
  ...tseslint.config({
    files: ["**/*.{ts,tsx}"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }),

  //
  // 🔹 3. Next.js Web-App
  //
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    plugins: { "@next": nextPlugin },
    rules: nextRules,
  },

  //
  // 🔹 4a. API – eigenes TS-Projekt für Lint
  //
  {
    files: ["apps/api/**/*.{ts,tsx,d.ts}"],
    languageOptions: {
      parserOptions: {
        project: ["./apps/api/tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  //
  // 🔹 4b. API – vitest.setup.js (Node-Kontext, process erlaubt)
  //
  {
    files: ["apps/api/vitest.setup.js"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },

  //
  // 🔹 4c. Tests (*.spec.ts / *.test.ts) – Regeln etwas lockern
  //
  {
  files: ["**/*.spec.ts", "**/*.test.ts"],
  rules: {
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "@typescript-eslint/require-await": "off",
    // Neu:
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
  },
},
{
  files: ["apps/api/src/modules/auth/device-proof.ts"],
  rules: {
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
  },
},

  //
  // 🔹 5. Globale Regelanpassungen
  //
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
