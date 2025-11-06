## Contributing Leitfaden

Danke, dass du zum Lokaltreu-Workspace beitragen möchtest! Bitte lies **AGENTS.md** aufmerksam – dort stehen Rollen, Entscheidungswege und alle verbindlichen Qualitätsregeln. Dieses Dokument fasst die wichtigsten Schritte für Contributors zusammen und verweist auf die relevanten Hilfsmittel.

### 1. Pflichtlektüre & Tools

- [AGENTS.md](./AGENTS.md) – Governance, RACI, CI-Gates, Incident-Flow.
- [CODEOWNERS](./.github/CODEOWNERS) – wer muss involviert werden.
- [SECURITY.md](./SECURITY.md) – Meldewege für Sicherheitsvorfälle.
- ADR-Template unter `docs/adr/_template.md` (falls neue ADR benötigt wird).

### 2. Vorbereitungen

1. Fork oder Feature-Branch von `main` erstellen.
2. Dependencies installieren: `npm install`.
3. Husky-Hooks installieren (einmalig): `npm run prepare`.
4. Optional: `npm run oas:lint` und `npm run gdpr:check`, wenn du an API oder Datenschutz arbeitest.

### 3. Entwicklungs-Checkliste

- [ ] Conventional Commit Messages verwenden.
- [ ] OpenAPI-Änderungen dokumentieren (ADR + OAS-Diff).
- [ ] Typen regenerieren: `npm run codegen`.
- [ ] Linting: `npm run lint`.
- [ ] Typecheck: `npm run typecheck`.
- [ ] Tests: `npm run test -w @lokaltreu/api` (und weitere projektspezifische Tests).
- [ ] Coverage: `npm run test:coverage -w @lokaltreu/api` (Standards ≥ 80 % Linien/Funktionen/Statements, Branches ≥ 65 %).
- [ ] GDPR-Gate: `npm run gdpr:check` falls Datenverarbeitung betroffen.

### 4. Pull-Requests

1. Rebase mit aktuellem `main`.
2. PR-Template ausfüllen und auf die relevanten ADRs/RFCs verlinken.
3. Mindestens ein Reviewer (zwei bei Breaking/API-Änderungen).
4. Alle Required Checks müssen grün sein:
   - `lint`, `typecheck`, `test`, `coverage`
   - `contract` (OAS + Typ-Diff)
   - `gdpr`
   - `secrets`
   - `build`
5. Bei Security-/Incident-Fixes Security-Rolle direkt pingen und Nachdokumentation innerhalb von 24 h sicherstellen.

### 5. Typische Stolpersteine

- **Markdown läuft weiter** → schließende ``` prüfen.
- **Tree wird inline dargestellt** → Codeblock korrekt öffnen/schließen.
- **Vitest- oder Redis-Mocks** → Dummy-URLs (`https://dummy`) verwenden, Upstash nicht real ansprechen.
- **Schema Drift** → immer `npm run codegen` + `git diff` vor PR.
- **GDPR-Konstanten** → `@lokaltreu/config` verwenden (`RETENTION_DAYS = 180`).

### 6. Nach dem Merge

- Changeset hinzufügen (falls Release-relevant): `npx changeset`.
- Release-Ablauf siehe AGENTS.md (SemVer, Tags `vMAJOR.MINOR.PATCH`).
- Beobachte CI/Monitoring nach Deployments.

Vielen Dank – stabile CI-Gates, saubere ADRs und gepflegte Contracts halten Lokaltreu auditierbar und compliant!
