import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requirements = [
  {
    path: "docs/05-Compliance.md",
    checks: [
      { includes: "Art. 11 – keine Identifizierung erforderlich", message: "Art. 11 DSR-Flow fehlt in docs/05-Compliance.md" },
      { includes: "180 Tage", message: "Retention 180 Tage fehlt in docs/05-Compliance.md" },
    ],
  },
  {
    path: "docs/runbooks/incident.md",
    checks: [
      { includes: "keine PII in neuen Logs", message: "Runbook Incident muss PII-Logging-Ausschluss enthalten" },
    ],
  },
  {
    path: "docs/runbooks/Incident-Breach.md",
    checks: [
      { includes: "≤72h", message: "Incident-Breach Runbook muss 72h Meldefenster enthalten" },
    ],
  },
];

const failures = [];

for (const requirement of requirements) {
  const filePath = resolve(requirement.path);
  if (!existsSync(filePath)) {
    failures.push(`Datei fehlt: ${requirement.path}`);
    continue;
  }
  const content = readFileSync(filePath, "utf-8");
  for (const check of requirement.checks) {
    if (!content.includes(check.includes)) {
      failures.push(check.message);
    }
  }
}

if (failures.length > 0) {
  console.error("GDPR-Checks fehlgeschlagen:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("GDPR-Checks bestanden: Art.11, Retention 180 Tage, keine PII in Logs, 72h Meldung vorhanden.");
