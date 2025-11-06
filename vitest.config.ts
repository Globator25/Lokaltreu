// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      lines: 80, functions: 80, branches: 80, statements: 80,
      include: [
        "apps/api/src/handlers/**/*.ts",
        "apps/api/src/security/**/*.ts",
        "apps/api/src/routes/**/*.ts",
        "apps/web/src/app/**/*.tsx"
      ],
      exclude: [
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "apps/api/src/security/**/*.d.ts",
        "apps/api/src/handlers/**/index.ts",
        "apps/api/src/security/**/index.ts",
        "apps/api/src/security/device/types.ts",
        "apps/api/src/security/tokens/types.ts",
        "apps/api/src/security/observability.ts",
        "apps/api/src/services/**",
        "apps/api/src/middleware/**",
        "apps/api/src/routes/index.ts",
        "apps/web/src/app/layout.tsx"
      ]
    }
  }
});
