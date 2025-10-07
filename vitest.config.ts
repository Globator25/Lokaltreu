import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['apps/**/src/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**','**/.next/**','**/dist/**','**/coverage/**',
        '**/*.d.ts','**/*config.*','**/next-env.d.ts','apps/**/public/**',
        '**/*.spec.*','**/*.test.*',   // Tests nicht werten
        'apps/**/src/**/*.js'          // transpiliertes JS ignorieren
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      reporter: ['text','html','lcov'],
      reportsDirectory: 'coverage'
    }
  }
});
