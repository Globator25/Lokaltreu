// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'apps/api/src/mw/**',
        'apps/api/src/middleware/**',
        'apps/api/src/modules/auth/**',
        'apps/api/src/auth/**'
      ],
      exclude: [
        'apps/**/dist/**',
        'apps/**/coverage/**',
        'apps/api/src/dev-server.*',
        'apps/api/src/server-main.*',
        'apps/api/src/handlers/admins/types.ts',
        'scripts/**',
        'tools/**',
        'artifacts/**',
        'work/**',
        '**/*.d.ts'
      ],
      thresholds: {
        lines: 73,
        functions: 89,
        branches: 66,
        statements: 73
      }
    }
  }
});
