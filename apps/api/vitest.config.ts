// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node-Backend: Node-Umgebung ist passend
    environment: 'node',

    // Jest-ähnliche Globals (describe, it, expect, etc.)
    globals: true,

    // Welche Dateien als Tests erkannt werden sollen
    include: [
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
    ],

    // Coverage-Konfiguration – wichtig für dein check-coverage.mjs
    coverage: {
      enabled: true,
      provider: 'v8',               // Standard bei Vitest
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage', // => apps/api/coverage/...
    },
  },
});
