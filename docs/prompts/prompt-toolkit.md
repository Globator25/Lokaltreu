# Lokaltreu Prompt-Toolkit (GPT-5)

Dieses Toolkit enthält kuratierte Prompts für wiederholbare, CI-konforme Aufgaben rund um Lokaltreu. Jede Vorlage referenziert explizit Zielpfad, Artefakt und Governance-Kontext (AGENTS, SPEC, Roadmap). Vor Nutzung bitte Einträge im [Prompt-Protokoll](prompt-log.md) dokumentieren.

---

## Typgenerierung (OpenAPI → Types)

```
<ziel> Generiere TypeScript-Typen für Route /stamps/claim (Request, Response, Problem) basierend auf lokaltreu-openapi-v2.0.yaml.
<kontext> Nutze @lokaltreu/types als Ziel, halte dich an RFC 7807 Fehlerobjekte, schema_drift muss 0 bleiben.
<anforderung> Output als streng typisierte Definitionen inkl. JSDoc, keine manuellen Anpassungen. Diese Typen werden in packages/types/src/stamps.ts gespeichert.
```

---

## Fehleranalyse (Problem+JSON)

```
<ziel> Analysiere claimStamp() und definiere Problem-Objekte (error_code, correlation_id, retry_after).
<kontext> Route: apps/api/src/stamps.ts, Referenz SPEC Kapitel Fehlercode. Anti-Replay/Plan-Limits müssen abgebildet werden.
<anforderung> Liefere RFC 7807-konforme Beispiele + Mapping error_code → HTTP status. Ergebnis fließt in packages/types und Handler.
```

---

## Onboarding-Erklärung (Docs)

```
<ziel> Erkläre registerAdminTenant() verständlich für Einsteiger (docs/onboarding.md).
<kontext> Fokus: Ablauf, Fehler, Security (Single-Admin, Alerts). Quelle SPEC US-1/US-2.
<anforderung> Schreibe in einfacher Sprache, max. 400 Wörter, erwähne Device-Proof Voraussetzungen.
```

---

## Testgenerierung (Vitest/Jest)

```
<ziel> Erstelle Tests für claimStamp(): Erfolg, TOKEN_EXPIRED, PLAN_NOT_ALLOWED.
<kontext> Verwende mocks entsprechend OpenAPI, Anti-Replay via Redis-Mock. Tests laufen über npm test --workspaces.
<anforderung> Struktur: arrange-act-assert, keine Snapshots. Datei apps/api/src/stamps.test.ts.
```

---

## Dokumentation (README)

```
<ziel> Aktualisiere README mit Abschnitten Projektziel, Setup, Monorepo-Struktur, API, CI-Gates, Lizenz.
<kontext> Nutze Informationen aus docs/01-Project-Canvas.md, docs/CI-Gates.md, AGENTS.
<anforderung> Prägnant, aber vollständig; Markdown-kompatibel.
```

---

## Refactoring (Handler)

```
<ziel> Schlanke Fehlerbehandlung und Typauslagerung in apps/api/src/stamps.ts.
<kontext> Berücksichtige Idempotency, Device-Proof, Plan-Gates. Typen liegen in packages/types.
<anforderung> Liefere Änderungsplan + Beispielcode (keine kompletten Dateien). Ziel: auditierbare Architektur.
```

---

## Prompt-Best-Practices

1. Nutze `<ziel>`, `<kontext>`, `<anforderung>` für Klarheit.  
2. Verweise auf konkrete Dateien/Abschnitte (SPEC, AGENTS, Roadmap).  
3. Halte Prompts kurz, eindeutig, CI-orientiert.  
4. Jede GPT-Nutzung im Prompt-Log dokumentieren (Zeit, Zweck, Ergebnis).
