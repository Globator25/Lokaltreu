# Lokaltreu AGENTS.md — Gold-Standard

**Einleitende Analogie: „Die Verfassung der KI“**
Stell dir das Repo als Staat vor. Code sind Gesetze, CI ist die Justiz, und AGENTS.md ist die Verfassung.
Sie legt verbindlich fest, wer was tun darf, wie entschieden wird und welche Prüfungen jeden Merge regeln. Ohne Verfassung herrscht Auslegungssache; mit Verfassung entsteht Vorhersagbarkeit, Wiederholbarkeit, Auditierbarkeit.

---
### 0) Metadaten
- **Geltung**: Verbindlich für alle Codex-Aktionen (CLI/IDE) und menschliche Beiträge.
- **Zielgruppe**: Einsteiger bis Senior. Kurze Sätze. MUSS/SOLL/KANN.
- **Version**: AGENTS.md v2.0-gold
- **Owner**: Tech Lead
- **Letzte Prüfung**: 2025-10-19

---
### 1) Referenzen
- **SPEC**: Technische Spezifikation v2.0
- **ARCH**: Architektur Lokaltreu
- **ROADMAP**: Gesamt-Roadmap
- **OpenAPI**: apps/api/openapi/lokaltreu-openapi-v2.0.yaml
- **Konvention**: Bei Widerspruch gilt Reihenfolge: SPEC → OpenAPI → ARCH → AGENTS.md → Code.
---
### 2) Projektfakten
- [cite_start]**Architektur**: Modularer Monolith (TypeScript), Next.js PWA, Node.js API [cite: 1032, 1041, 1043]
- [cite_start]**Standards**: OpenAPI 3.1 (SSOT), RFC 7807 (Problem+JSON), Idempotency-Key [cite: 213, 214, 148]
- [cite_start]**Sicherheit**: Ed25519 Device-Proof, WORM-Audit, R2-Export, Retention 180 Tage [cite: 139, 152, 155]
- [cite_start]**Environments**: dev, stage, prod (EU-Region), isolierter Remote-State [cite: 705, 715]
---
### 3) Build | Run | Test
- **Install**: `npm ci` (Installiert Abhängigkeiten exakt wie im Projekt-Lockfile definiert)
- **Build**: `npm run build` (Erstellt die lauffähige Version der Software)
- **Lint**: `npm run lint` (Prüft den Code auf Stilfehler)
- **Tests**: `npm test --workspaces -- --coverage` (Führt alle Tests aus und zeigt die Testabdeckung an)
- **Web Dev**: `npm run -w apps/web dev` (Startet den Entwicklungs-Server für die PWA)
- **API Dev**: `npm run -w apps/api dev` (Startet den Entwicklungs-Server für die API)
- **Mock-Server**: `npx prism mock apps/api/openapi/lokaltreu-openapi-v2.0.yaml -p 4010` (Simuliert die API für Frontend-Tests)
---
### 4) Contracts & Standards
- **SSOT**: OpenAPI 3.1. `schema_drift = 0` ist MUSS.
- **Codegen**:
  ```bash
  npx openapi-typescript apps/api/openapi/lokaltreu-openapi-v2.0.yaml \
    -o packages/types/src/index.d.ts
---
### 5) Rollen, Guardrails, KPIs, Mehrwert
- **Prinzip**: Eine Aufgabe ruft stets eine primäre und ggf. eine sekundäre Rolle auf.

- **Contract-Sheriff**
  - **Aufgabe**: OpenAPI-Codegen, Type-Sync, Schema-Drift-Erkennung
  - **No-Gos**: Handgeschriebene API-Typen
  - **KPI**: `schema_drift = 0`
  - **Mehrwert**: Keine Überraschungen zwischen Frontend und Backend

- **ProblemJSON-Arbiter**
  - **Aufgabe**: RFC 7807-Factory, einheitliche Fehlercodes
  - **No-Gos**: Ad-hoc-Fehler
  - **KPI**: `error_conformity = 100%`
  - **Mehrwert**: Debugging beschleunigt, Support reproduzierbar

- **Idempotency-Guardian**
  - **Aufgabe**: Anti-Replay via Redis `SETNX` + TTL, Header-Pflicht
  - **No-Gos**: Idempotenz im Business-Code
  - **KPI**: `replay_blocks = 100%`
  - **Mehrwert**: Kein Doppelbuchen, saubere Finanz- und Audit-Spuren

- **Device-Proof-Engineer**
  - **Aufgabe**: Ed25519-Validierung für `X-Device-Proof`
  - **No-Gos**: Private Keys serverseitig speichern
  - **KPI**: `proof_failures_caught = 100%`
  - **Mehrwert**: Missbrauchsschutz bei sensiblen Aktionen

- **Audit-Officer**
  - **Aufgabe**: WORM-Audit, signierte Exporte → R2, Retention 180 Tage
  - **No-Gos**: PII in Logs, fehlende Artefakte
  - **KPI**: `audit_gaps = 0`
  - **Mehrwert**: Prüf- und Nachweisfähigkeit

- **Test-Pilot**
  - **Aufgabe**: Teststrategie, Parallelisierung, Contract-Tests, Coverage
  - **No-Gos**: Snapshots für JSON-APIs
  - **KPI**: `coverage ≥ 80%`, `contract_pass = 100%`
  - **Mehrwert**: Qualität messbar, Regressionen fallen sofort auf

- **Docs-Keeper**
  - **Aufgabe**: JSDoc, README, „Was ist neu?“-Abschnitte, Entwickler-Onboarding
  - **No-Gos**: Marketing-Sprache, veraltete Beispiele
  - **KPI**: `docs_freshness ≤ 7 Tage`, `broken_links = 0`
  - **Mehrwert**: Einsteiger finden schnell Einstiegspunkte
---
### 6) CI-Gates (MUSS) + KPIs
- [cite_start]**Coverage**: `lines ≥ 80%`, `functions ≥ 80%`, `branches ≥ 80%`, `statements ≥ 80%` [cite: 606]
- **Contract**: OpenAPI-Validierung grün; `schema_drift = 0`
- **Fehlerformat**: `error_conformity = 100%` (RFC 7807)
- **Anti-Replay**: Paralleltest grün; `replay_blocks = 100%`
- **Device-Proof**: Positiv/Negativ-Fälle grün
- [cite_start]**Plan-Gates**: Starter → `403 PLAN_NOT_ALLOWED` getestet [cite: 373]
- **OpenAPI-Lint**: `pass`
- **Terraform**: `fmt` + `validate` grün (EU-Region erzwungen)
- **GDPR**: Retention 180 Tage, Art. [cite_start]11-Prozesse grün [cite: 173, 166]

---
### 7) Workflows und Begründung der Trennung
- **ci.yml**: Kernqualität (Lint, Codegen, Build, Tests, Contract, Coverage).
  - **Vorteil**: Schnell, fokussiert, läuft bei jedem PR. Fehlerschwerpunkt: Code.
- **gdpr-compliance.yml**: Retention, Art. 11, Log-PII-Checks, Artefakt-Aufbewahrung.
  - **Vorteil**: Rechtliche Anforderungen ändern sich separat. Unabhängig versionier- und eskalierbar.
- **security-gates.yml**: Device-Proof, Anti-Replay, Rate-Limits.
  - **Vorteil**: Sicherheitsregeln haben andere Lastprofile und Reviewer. Minimiert Rauschen im Kern-CI.
- **Strategischer Gewinn**: Entkoppelte Verantwortlichkeiten, schnellere Feedback-Schleifen, klare Ownership und Audits pro Domäne.
---
### 8) Aufgabenrezepte (CLI/IDE, kurz und reproduzierbar)
- **1) OpenAPI → Types**
  ```bash
  codex exec "Generiere @lokaltreu/types aus OpenAPI und fixe Imports" \
    --role Contract-Sheriff \
    --context @apps/api/openapi/lokaltreu-openapi-v2.0.yaml @packages/types/**
- **2) Handler (idempotent, RFC 7807)**
  ```bash
  codex exec "Implementiere POST /stamps/claim idempotent, Fehler RFC7807" \
    --role Idempotency-Guardian,ProblemJSON-Arbiter,Audit-Officer \
    --context @apps/api/openapi/** @apps/api/src/mw/** @apps/api/src/handlers/**
- **3) Contract-Tests**
  codex exec "Schreibe Vitest Contract-Tests mit chai-openapi-response-validator" \
  --role Contract-Sheriff,Test-Pilot \
  --context @apps/api/openapi/** @tests/**
- **4) Parallel-Anti-Replay**
  codex exec "Erstelle Anti-Replay-Test für Idempotency-Key (10 parallel)" \
  --role Idempotency-Guardian,Test-Pilot \
  --context @apps/api/src/mw/idempotency.ts @tests/security/**
- **5) Plan-Gate**
  codex exec "Füge Plan-Gate (403 PLAN_NOT_ALLOWED) inkl. Tests hinzu" \
  --role ProblemJSON-Arbiter,Test-Pilot \
  --context @apps/api/src/handlers/referrals.ts @apps/api/openapi/**
- **6) Device-Proof**
  codex exec "Implementiere Ed25519-Validierung für X-Device-Proof" \
  --role Device-Proof-Engineer \
  --context @apps/api/src/middleware/device-auth.ts
-**7) Docs-Sync**
  codex exec "Aktualisiere JSDoc+README mit Beispielen" \
  --role Docs-Keeper \
  --context @apps/api/src/** @README.md
---
### 9) Security & DSGVO
- **Keine PII in Logs**. Erlaubte IDs: `tenant_id`, `device_id`, `card_id`.
- **Secrets nur via SOPS** (`*.enc.tfvars`).
- **EU-Region erzwingen**.
- **Art. 11 DSR** ohne Zusatzidentifizierung.
- **Retention 180 Tage**. **WORM-Audit**. **Signierte Exporte** (R2).

---
### 10) Audit-Trail
- Jeder Codex-Run per `tee` spiegeln:
  ```bash
  … | tee -a artifacts/codex-$(date +%Y%m%d-%H%M%S).log

-----

### 11\) ZENTRALE PR-CHECKLISTE (Referenz für Mensch & KI)

  - **Nutzen**: Ein Schalter pro Gate. Einsteiger sehen sofort, was fehlt. KI kann gezielt nachbessern.
  - [ ] **Lint grün**
  - [ ] **Build grün**
  - [ ] **Tests grün + Coverage ≥ 80 %**
  - [ ] **Contract-Tests grün, `schema_drift = 0`**
  - [ ] **Fehler 100 % RFC 7807 konform**
  - [ ] **Parallel-Anti-Replay grün (1×201, 9×409)**
  - [ ] **Device-Proof-Fälle grün**
  - [ ] **Plan-Gate-Cases grün (Starter → 403 PLAN\_NOT\_ALLOWED)**
  - [ ] **OpenAPI-Lint pass**
  - [ ] **Terraform fmt + validate grün (EU-Only)**
  - [ ] **GDPR-Checks grün (Art. 11, Retention 180 Tage)**
  - [ ] **Audit-Artefakte erzeugt (Logs, Diffs, Reports)**
  - [ ] **Commit nach Conventional Commits, PR-Beschreibung verlinkt CI-Run + benannte Rolle(n)**

-----

### 12\) Pflege & Versionierung

  - Änderungen an `AGENTS.md` nur via PR. Reviewer: Owner + betroffene Rolle.
  - Quartalsreview: Rollen, KPIs, Gates.
  - Changelog-Eintrag in `docs/CHANGELOG.md` unter „Governance“.

-----

### 13\) CI-Sentinels (für automatisches Linting dieser Datei)

  - Diese Zeilen dienen der CI-Validierung. Nicht löschen.
  - `[SENTINEL] SECTION: Projektfakten`
  - `[SENTINEL] SECTION: CI-Gates (MUSS)`
  - `[SENTINEL] SECTION: Aufgabenrezepte`
  - `[SENTINEL] SECTION: Audit-Trail`
  - `[SENTINEL] SECTION: ZENTRALE PR-CHECKLISTE`

-----

### 14\) Anhang: Implementierungs-Snippets

  - **RFC 7807-Factory (vereinfacht)**
    ```typescript
    import type { components } from '@lokaltreu/types';
    type ErrorCode = components['schemas']['Problem']['error_code'];
    export interface ProblemDocument { type:string; title:string; status:number; error_code:ErrorCode; correlation_id:string; detail?:string; instance?:string; }
    export const problem = (p: ProblemDocument) =>
      new Response(JSON.stringify(p), { status:p.status, headers:{ 'content-type':'application/problem+json' }});
    ```
  - **Idempotenz (Redis)**
    ```typescript
    const ok = await redis.setnx(`idem:${key}`, '1'); if (!ok) return problem({type:'/errors/duplicate',title:'Duplicate',status:409,error_code:'TOKEN_REUSE',correlation_id:c()});
    await redis.expire(`idem:${key}`, 24*3600);
    ```
  - **Vitest-Coverage & Parallelisierung**
    ```typescript
    export default { test:{ maxThreads:'50%', minThreads:4 }, coverage:{ enabled:true, lines:80, functions:80, branches:80, statements:80 } };
    ```
  - **Contract-Validierung**
    ```typescript
    import chai from 'chai';
    import oas from 'chai-openapi-response-validator';
    chai.use(oas('apps/api/openapi/lokaltreu-openapi-v2.0.yaml'));
    ```
  - **Parallel-Anti-Replay (Test)**
    ```typescript
    const k = crypto.randomUUID();
    const calls = Array.from({length:10}, () => fetch('/stamps/claim',{method:'POST',headers:{'Idempotency-Key':k,'X-Device-Proof':proof}}));
    const rs = await Promise.allSettled(calls);
    // Erwartung: 1×201, 9×409
    ```

-----

### 15\) Quickstart für Einsteiger

  - **Lesen**: Abschnitt 2–6, dann 11.
  - **Befehl**:
    ```bash
    codex --model gpt-5-codex
    codex exec "Implementiere POST /stamps/claim idempotent, Fehler RFC7807" \
      --role Idempotency-Guardian,ProblemJSON-Arbiter \
      --context @apps/api/openapi/** @apps/api/src/**
    ```
  - PR eröffnen und Checkliste abarbeiten.