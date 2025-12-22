import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['apps/web/vitest.setup.ts'],
    include: [
      'apps/web/src/**/*.{test,spec}.{ts,tsx}',
      'apps/api/src/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],

      // Nur "echte" Quellcodes einbeziehen
      include: [
        'apps/web/src/**/*.{ts,tsx}',
        'apps/api/src/**/*.ts',
        'tests/**/*.ts',
      ],
      // Alles ausschließen, was nur Artefakte/Helfer ist
      exclude: [
        '**/dist/**',
        '**/coverage/**',
        'scripts/**',
       
      ],

      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
