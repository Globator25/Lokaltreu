// apps/web/eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

/**
 * ESLint Flat Config für apps/web
 * - lintet JS/TS/TSX
 * - ignoriert Build-, Tooling- und Coverage-Dateien
 */

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Globale Ignores
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'coverage/**',
      // falls du bestimmte Config-Files komplett ausklammern willst:
      // 'next.config.ts',
      // 'postcss.config.js',
      // 'tailwind.config.js',
    ],
  },

  // Hauptkonfiguration für Quellcode-Dateien
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // kein Projekt-TSConfig nötig für den Parser im ersten Schritt
      },
      globals: {
        // Browser-Globals (React/Next)
        ...globals.browser,
        // Node-Globals, die in Config-/Testfiles verwendet werden
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    // Basale Regeln aktivieren (JS-Empfehlungen)
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
