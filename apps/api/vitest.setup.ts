// apps/api/vitest.setup.ts
// Minimales Setup für Vitest (API-Workspace).
// Keine Secrets, keine Netz-Zugriffe, keine globalen Mocks, solange nicht nötig.

import { beforeAll } from "vitest";

beforeAll(() => {
  // Beispiel: Konsistente Zeitzone für Tests (optional)
  process.env.TZ ??= "UTC";
});
