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

  // 🔒 Lokaltreu-spezifische Regeln
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      lokaltreu: lokaltreuPlugin,
    },
    rules: {
      "lokaltreu/no-manual-api-types": "error",
    },
  },
];
