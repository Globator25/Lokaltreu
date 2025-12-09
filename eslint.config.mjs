// eslint.config.mjs – Root-Konfiguration für das Lokaltreu-Monorepo

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

/**
 * Flat-Config-Setup für ESLint 9
 *
 * - Gilt für das gesamte Monorepo
 * - Ignoriert Build-/Coverage-Verzeichnisse
 * - Ignoriert alle Vitest-Config-Files (vitest.config.*), um TS/ESLint-Projektkonflikte zu vermeiden
 * - Lintet:
 *   - apps/web: React/Next-Frontend (Browser-Kontext, TS/TSX)
 *   - apps/api: Node-Backend (Node-Kontext, TS)
 */

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Globale Ignorierregeln
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.turbo/**',
      // Vitest-Config-Dateien in allen Paketen ignorieren
      '**/vitest.config.*',
    ],
  },

  // Frontend (apps/web) – React/Next, Browser-Umgebung
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        // KEIN "project" hier – vermeidet parserOptions.project-Probleme
      },
      globals: {
        ...globals.browser,
        React: 'readonly', // falls React als Global im Code benutzt wird
      },
    },
    rules: {
      // Basis-Empfehlungen
      ...js.configs.recommended.rules,
      // hier können später noch spezifische Regeln ergänzt werden
    },
  },

  // Backend (apps/api) – Node-Umgebung, TypeScript
  {
    files: ['apps/api/**/*.{js,ts}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        // WICHTIG: kein "project" → kein Type-Aware-Linting, aber auch keine TS-Projektfehler
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Basis-Empfehlungen
      ...js.configs.recommended.rules,

      // Logging-Policy: nur warn/error erlauben
      'no-console': [
        'error',
        { allow: ['warn', 'error'] },
      ],
    },
  },
];
