// Platzhalter für schema_drift-Check in Schritt 4.
// Prüft vorerst nur, ob die OpenAPI-SSOT-Datei existiert.

import { access } from 'node:fs/promises';

const openapiPath = 'apps/api/openapi/lokaltreu-openapi-v2.0.yaml';

try {
  await access(openapiPath);
  console.log('[schema_drift] OK – OpenAPI-SSOT gefunden:', openapiPath);
  process.exit(0);
} catch {
  console.error('[schema_drift] FEHLER – OpenAPI-Datei fehlt:', openapiPath);
  process.exit(1);
}
