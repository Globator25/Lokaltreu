// scripts/check-gdpr-structure.mjs
// Einfacher DSGVO-/Compliance-Struktur-Check gemäß Roadmap Schritt 2.
// Ziel: Existenz und minimale Markdown-Struktur der Kern-Dokumente prüfen.

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Dokumente, die laut Roadmap vorhanden sein müssen.
 * Pfade sind relativ zum Repo-Root.
 */
const REQUIRED_DOCS = [
  "compliance/AVV.md",
  "compliance/TOMs.md",
  "compliance/RoPA.md",
  "compliance/DPIA.md",
  "compliance/Infos-DE.md",
  "compliance/Retention-Policy.md",
  "docs/runbooks/Incident-Breach.md",
];

/**
 * Prüft ein einzelnes Markdown-Dokument auf:
 * - Existenz
 * - Nicht-Leer
 * - Mindestens eine Markdown-Überschrift (# ...)
 */
async function checkDoc(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);

  try {
    const stat = await fs.stat(fullPath);

    if (!stat.isFile()) {
      return {
        path: relativePath,
        ok: false,
        reason: "kein reguläres File (erwartet Markdown-Datei)",
      };
    }

    const content = await fs.readFile(fullPath, "utf8");
    const trimmed = content.trim();

    if (trimmed.length === 0) {
      return {
        path: relativePath,
        ok: false,
        reason: "Datei ist leer",
      };
    }

    // Minimale Struktur: mindestens eine Markdown-Überschrift
    const hasHeading = /^#{1,6}\s+.+/m.test(content);

    if (!hasHeading) {
      return {
        path: relativePath,
        ok: false,
        reason: "keine Markdown-Überschrift (# ...) gefunden",
      };
    }

    return { path: relativePath, ok: true };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        path: relativePath,
        ok: false,
        reason: "Datei fehlt",
      };
    }

    return {
      path: relativePath,
      ok: false,
      reason: `Fehler beim Lesen: ${error.message}`,
    };
  }
}

async function main() {
  console.log("[gdpr] Prüfe Compliance-Dokumente gemäß Roadmap Schritt 2 …");

  const results = [];
  for (const doc of REQUIRED_DOCS) {
    // sequentiell, damit Logs gut lesbar bleiben
    // bei Bedarf könnte man hier Promise.all verwenden
    // für parallele Checks.
    // eslint-disable-next-line no-await-in-loop
    const result = await checkDoc(doc);
    results.push(result);

    if (result.ok) {
      console.log(`[gdpr] OK   ${result.path}`);
    } else {
      console.error(`[gdpr] FAIL ${result.path} → ${result.reason}`);
    }
  }

  const failures = results.filter((r) => !r.ok);

  if (failures.length > 0) {
    console.error(
      `[gdpr] Struktur-Check fehlgeschlagen: ${failures.length} von ${REQUIRED_DOCS.length} Dokument(en) haben Probleme.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[gdpr] Struktur-Check erfolgreich: ${REQUIRED_DOCS.length}/${REQUIRED_DOCS.length} Dokumente vorhanden und minimal strukturiert.`
  );
}

try {
  await main();
} catch (error) {
  console.error("[gdpr] Unerwarteter Fehler im Struktur-Check:", error);
  process.exit(1);
}
