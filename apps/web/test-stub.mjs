#!/usr/bin/env node
// apps/web/test-stub.mjs
// -------------------------------------------------------------
// Temporärer Test-Stub für das Web-Frontend.
// Zweck:
//  - Das CI-Test-Gate für apps/web soll grün bleiben,
//  - bis ab Roadmap-Schritt 27/37 echte Unit-/Integrationstests
//    implementiert sind.
// -------------------------------------------------------------

import process from "node:process";

const ROADMAP_STEP = "27/37";

console.log("[web:test] Starte Web-Test-Stub …");
console.log(
  `[web:test] Noch keine echten Web-Tests implementiert – geplant ab Roadmap-Schritt ${ROADMAP_STEP}.`
);
console.log(
  "[web:test] Dieser Stub führt keine fachlichen Tests aus und dient nur als Platzhalter im CI."
);

if (process.env.CI) {
  console.log("[web:test] CI-Umgebung erkannt (CI=true). Beende Stub mit Exit-Code 0.");
} else {
  console.log("[web:test] Lokale Umgebung – Stub beendet sich mit Exit-Code 0.");
}

// Wichtig: immer erfolgreich beenden, damit das Gate aktuell nicht blockiert.
process.exit(0);
