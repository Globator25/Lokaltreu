# 🧠 Lokaltreu Prompt-Toolkit für GPT-5 mini

Dieses Toolkit enthält wiederverwendbare Prompts zur auditierbaren, typensicheren Entwicklung von Lokaltreu. Jeder Prompt ist so formuliert, dass er reproduzierbare, CI-konforme Ergebnisse liefert und für echte Anfänger verständlich bleibt.

---

## 🧩 Typgenerierung

> Bitte generiere die TypeScript-Typen für die Route `/stamps/claim` aus folgendem OpenAPI-Schema. Achte auf RFC 7807-konforme Fehlerobjekte und nutze `@lokaltreu/types` als Zielstruktur. Die Typen sollen CI-konform, dokumentiert und wiederverwendbar sein.

✅ Verwendet für: `StampClaimRequest`, `StampClaimResponse`, `Problem`  
📁 Zielpfad: `packages/types/src/stamps.ts`

---

## 🧪 Fehleranalyse

> Bitte analysiere die Fehlerbehandlung in `claimStamp()` und schlage ein RFC 7807-konformes `Problem`-Objekt vor. Achte auf sinnvolle `error_code`-Werte, `correlation_id` und `retry_after`. Ziel: auditierbare Fehlerstruktur für CI und Monitoring.

✅ Verwendet für: `Problem`-Typ in `packages/types`  
📁 Zielpfad: `apps/api/src/stamps.ts`

---

## 🧑‍🏫 Onboarding-Erklärungen

> Bitte erkläre die Funktion `registerAdminTenant()` für absolute Anfänger. Ziel: verständliche Doku, Fehlerverhalten, Rückgabewerte, Sicherheitsaspekte. Nutze einfache Sprache, klare Beispiele und vermeide Fachjargon.

✅ Verwendet für: `docs/onboarding.md`  
📁 Zielpfad: `apps/api/src/tenants.ts`

---

## 🧪 Testgenerierung

> Bitte schreibe Jest-Tests für `claimStamp()` inkl. Erfolgsfall, Fehlerfall (TOKEN_EXPIRED), und Mock-Daten. Ziel: CI-konforme Testabdeckung mit klarer Struktur und Wiederverwendbarkeit.

✅ Verwendet für: `apps/api/src/stamps.test.ts`  
📁 Zielpfad: `apps/api/src/stamps.test.ts`

---

## 📚 Dokumentation

> Bitte erstelle ein README für Lokaltreu mit folgenden Abschnitten: Projektziel, Setup-Anleitung, Monorepo-Struktur, API-Dokumentation, CI-Checks, Lizenz. Ziel: verständliche Einstiegshilfe für neue Entwickler und Reviewer.

✅ Verwendet für: `README.md`  
📁 Zielpfad: Projektwurzel

---

## 🧭 Refactoring

> Bitte analysiere die Datei `apps/api/src/stamps.ts` und schlage ein Refactoring vor, das die Fehlerbehandlung verbessert, Typen auslagert und CI-ready ist. Ziel: auditierbare Architektur mit klarer Modularisierung und Wiederverwendbarkeit.

✅ Verwendet für: Refactoring-Vorschläge in `apps/api/src/stamps.ts`  
📁 Zielpfad: `apps/api/src/stamps.ts`, `packages/types`

---

## 🧠 Best Practices für Prompting

- Verwende `<ziel>`, `<kontext>` und `<anforderung>` zur Strukturierung
- Halte Prompts kurz, präzise und CI-orientiert
- Dokumentiere jede GPT-Nutzung im [Prompt-Protokoll](prompt-log.md)
