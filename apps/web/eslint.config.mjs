import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import lokaltreuPlugin from "@lokaltreu/eslint-plugin-lokaltreu";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // ⛔️ Build- & Artefakt-Ordner explizit ignorieren (Flat Config Pflicht)
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
    ],
  },

  // ✅ Next.js + TypeScript Regeln
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 🔒 Lokaltreu-spezifische Regeln (DoD Schritt 11: no-manual-api-types)
  // Hinweis: Wir sichern doppelt ab:
  // 1) Custom Rule aus @lokaltreu/eslint-plugin-lokaltreu (primär)
  // 2) Zusätzliche Restriktion via no-restricted-imports (fallback, auditierbar)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      lokaltreu: lokaltreuPlugin,
    },
    rules: {
      // Primärregel (wie bisher)
      "lokaltreu/no-manual-api-types": "error",

      // Fallback/Absicherung: verhindert "Shadow Types" oder lokale Contract-Kopien
      // Erlaubt ist ausschließlich @lokaltreu/types (generiert aus OpenAPI SSOT).
      "no-restricted-imports": [
  "error",
  {
    patterns: [
      // Nur relative Imports verbieten, die auf manuelle API-Typ-Dateien hindeuten
      {
        group: [
          "./openapi*",
          "../openapi*",
          "./*openapi*",
          "../*openapi*",

          "./*api*types*",
          "../*api*types*",

          "./*dto*",
          "../*dto*",

          "./*schema*",
          "../*schema*"
        ],
        message:
          "no-manual-api-types: Keine manuellen API/DTO/Schema-Typen im Frontend. Nutze ausschließlich @lokaltreu/types (OpenAPI SSOT).",
      },
    ],
  },
],
    },
  },
];
