# AGENTS – Lokaltreu v3.6 (Governance + Codex-Optimiert)

**Geltung:** Verbindlich für Menschen & Codex (CLI + GitHub)  
**Status:** Final, auditierbar, Go-Live-fähig  
**Owner:** Tech Lead  
**Letzte Prüfung:** _(heutiges Datum)_  

---

## 0) Metadaten & normative Reihenfolge

Bei Widerspruch gilt folgende Reihenfolge:

1. **SPEC v2.0**  
2. **OpenAPI v2.0**  
3. **ARCH**  
4. **AGENTS.md**  
5. **ROADMAP 2.3.1**  
6. **Code**

Codex MUSS diese Reihenfolge strikt anwenden.

---

## 1) Projektfakten

- Architektur: Modularer Monolith (TypeScript)  
- Frontend: Next.js PWA  
- Backend: Node.js API  
- Standards: OpenAPI 3.1 (SSOT), RFC 7807, Idempotency-Key (24h)  
- Sicherheit:
  - Ed25519 Device-Proof (Signatur über `method|path|ts|jti`)  
  - Redis Anti-Replay (SETNX + TTL)  
  - Rate-Limits (Tenant/IP/Card/Device)  
  - Einmalige Tokens (jti = UUIDv7)  
- Audit & DSGVO:
  - WORM-Audit, Retention 180 Tage  
  - Tombstone-DSR mit `deleted_subjects` Tabelle  
  - Restore: Tombstones werden nach Restore erneut angewendet  
  - Art. 6(1)(f) DSGVO, Art. 11-Pfad, keine zusätzliche Identifizierung  
- Environments: dev, stage, prod (EU-Region enforced)  
- Deployment: Blue-Green, Expand-Contract-Migrationspattern  

---

## 2) Referenzen

- SPEC: Technische Spezifikation – Lokaltreu v2.0  
- SaaS-Beschreibung: Lokaltreu SaaS v1.4  
- ROADMAP: Lokaltreu Gesamt-Roadmap 2.3.1  
- ARCH: Architektur-Empfehlung Lokaltreu  
- OpenAPI: `apps/api/openapi/lokaltreu-openapi-v2.0.yaml`  
- AGENTS-Goldstandard: `Lokaltreu AGENTS.md — Gold-Standard`  

---

## 3) Rollen & Verantwortlichkeiten (Mensch & Codex)

### Contract-Sheriff
- Aufgabe: OpenAPI-Konformität, Codegen, schema_drift = 0  
- No-Gos: handgeschriebene API-Typen  
- KPI: `schema_drift = 0`  

### ProblemJSON-Arbiter
- Aufgabe: RFC-7807-Konformität, Fehlercodes, Konsistenz  
- KPI: `error_conformity = 100%`  

### Idempotency-Guardian
- Aufgabe: Anti-Replay, Idempotency-Key, Retry-Strategie  
- KPI: `replay_blocks = 100%`  

### Device-Proof-Engineer
- Aufgabe: Ed25519-Validierung, Zeitdrift-Handling (±30s), Proof-Fehler  
- KPI: `proof_failures_caught = 100%`  

### Audit-Officer
- Aufgabe: WORM-Audit, Exporte, Retention 180 Tage, Tombstone-Flows  
- KPI: `audit_gaps = 0`  

### Test-Pilot
- Aufgabe: Tests, Coverage, Contract-Tests, Paralleltests  
- KPI: `coverage ≥ 80%`, `contract_pass = 100%`  

### Docs-Keeper
- Aufgabe: JSDoc, README, ADRs, Changelogs  
- KPI: `docs_freshness ≤ 7 Tage`  

### FinOps-Controller
- Aufgabe: Kostenmetriken (u. a. `cost_per_tenant`), Kosten-Drifts, Alerts  
- KPI: `finops_anomalies_resolved = 100%`  

---

## 4) Codex-Rolle (automatische Reviews)

Codex agiert als:

- Senior Reviewer  
- Security- und Architektur-Auditor  
- Contract-Sheriff-Assistent  
- DSGVO-Wächter (Art. 11, Logs, Retention)  
- Anti-Replay- & Device-Proof-Prüfer  
- Plan-Gate-Validator  

Codex MUSS High-Signal-Feedback liefern und Low-Signal-Hinweise vermeiden.

---

## 5) High-Signal-Priorisierung (für Codex)

Codex MUSS Feedback in dieser Reihenfolge priorisieren:

1. Sicherheit (Auth, Device-Proof, Anti-Replay, Token-TTL)  
2. SPEC-Konformität (Flows, Edge-Cases, Fehlercodes)  
3. OpenAPI-Konformität (Schemas, Problem+JSON)  
4. Idempotenz (Idempotency-Key, Nebenwirkungen)  
5. Plan-Gates (Starter/Plus/Premium, Referral-Gate)  
6. DSGVO / Art. 11 / Logs / Retention  
7. Auditierbarkeit (WORM, Events, Nachweise)  
8. Performance (p50/p95/p99, Hot-Routes)  
9. Architektur-Konsistenz (Modularer Monolith, Expand-Contract)  

---

## 6) Sicherheitsregeln (MUSS)

### 6.1 Keine PII in Logs
- Erlaubt: `tenant_id`, `device_id`, `card_id`  
- Nicht erlaubt: Klardaten wie Name, E-Mail, Telefonnummer; IP-Adressen in App-Logs  

### 6.2 Token-Sicherheit
- `jti = UUIDv7`  
- TTL: z. B. StampToken 60s, Device-Link 15 Min  
- Einmaligkeit MUSS erzwungen werden (DB/Redis + Constraints)  

### 6.3 Device-Proof
- Algorithmus: Ed25519  
- Payload: `method|path|ts|jti`  
- Zeitdrift: ±30s, Abweichung → Fehler (Problem+JSON)  

### 6.4 Rate-Limits
- `/stamps/claim` → 30 rpm pro Card  
- `/rewards/redeem` → 10 rpm pro Device  
- Tenant → 600 rpm  
- IP anonym → 120 rpm  

### 6.5 Anti-Replay
- Redis SETNX + TTL  
- Paralleltest MUSS: 10 parallele Versuche → 1×201, 9×409  

---

## 7) SPEC-Konformität (MUSS)

Codex MUSS prüfen:

- Hot-Routes exakt wie in SPEC v2.0 modelliert  
- Fehlerbilder: 400/401/403/409/422/429/5xx gemäß RFC 7807  
- Referral-Flow: stempelbasiert, Self-Referral blockiert, Velocity-Limits  
- Geräte-Onboarding: Link TTL 15 Min, Einmaligkeit gewährleistet  
- ACID-Transaktionen für Stempel & Prämien  
- Expand-Contract-Migrationspattern bei jeder Schema-Änderung  

---

## 8) OpenAPI-Konformität (MUSS)

- Request/Response-Bodies entsprechen OpenAPI  
- Fehlerformat: `application/problem+json` (RFC 7807)  
- `error_code` aus Enum, konsistent zu SPEC/OpenAPI  
- `schema_drift = 0` (keine Abweichung zwischen Code & Contract)  
- Keine manuell gepflegten API-Typen im Frontend (nur Codegen)  

---

## 9) Plan-Gates (MUSS)

- Starter → Referral blockiert → `403 PLAN_NOT_ALLOWED`  
- Geräte-Limits enforced gemäß Plan  
- Stempel-Limits blockieren nicht den Betrieb:
  - Soft-Upgrade-Flow (Benachrichtigung + Upgrade-Option)  
  - keine Hard-Sperre der Stempelvergabe  

---

## 10) DSGVO-Regeln (MUSS)

- Rechtsgrundlage: Art. 6(1)(f) DSGVO (Betrieb, Sicherheit, Fraud-Prevention)  
- Art. 11-Pfad:
  - keine zusätzliche Identifizierung  
  - Matching nur auf vorhandene Pseudonyme (z. B. Card-ID, Device-Kontext)  
  - falls nicht möglich → Hinweis nach Art. 11(2)  
- Logs sind personenbezogene Daten:
  - RoPA-Eintrag „Betriebs-/Sicherheitslogs“  
  - Retention 180 Tage  
- Tombstone-Konzept:
  - DSR-Löschungen → Eintrag in `deleted_subjects`  
  - Backups bleiben unverändert  
  - nach Restore werden Tombstones erneut angewendet und Subjekte wieder gelöscht/pseudonymisiert  

---

## 11) Audit-Regeln (MUSS)

- WORM-Audit für sicherheitsrelevante Events  
- Ereignisse z. B.: `device.register`, `stamp.token.issued`, `stamp.claimed`,  
  `reward.redeemed`, `referral.link.issued`, `referral.first_stamp.qualified`,  
  `referral.bonus_stamp.credited`  
- Retention: 180 Tage, signierte Exporte  
- `audit_gaps = 0` ist Ziel-KPI  

---

## 12) Architektur-Regeln

- Modularer Monolith (keine Microservices)  
- Idempotenz-Layer von Domain-Logik getrennt  
- Blue-Green-Kompatibilität: alte API-Version MUSS gegen neues Schema funktionieren  
- Expand-Contract:
  - Schema-Erweiterung kompatibel  
  - Backfill-Job  
  - erst danach Entfernen alter Felder/Strukturen  

---

## 13) Performance-Regeln

- p50 ≤ 500 ms  
- p95 ≤ 3000 ms  
- p99 ≤ 6000 ms  
- Hot-Routes (`/stamps/claim`, `/rewards/redeem`) priorisiert optimieren  

---

## 14) Codex-Verbote (NICHT erlaubt)

Codex DARF NICHT:

- reine Formatierungs-Hinweise geben  
- Style-Nits kommentieren (z. B. „Semikolon fehlt“)  
- alternative Business-Entscheidungen vorschlagen  
- irrelevante Kommentare ohne SPEC-/OpenAPI-Bezug erzeugen  

---

## 15) ZENTRALE PR-CHECKLISTE (für Mensch & KI)

- ☐ SPEC-Konformität geprüft  
- ☐ OpenAPI-Konformität, `schema_drift = 0`  
- ☐ Fehler 100 % RFC 7807-konform  
- ☐ Anti-Replay (Paralleltests: 1×201, 9×409)  
- ☐ Device-Proof (Positiv/Negativ-Fälle)  
- ☐ Plan-Gates (Starter → 403 PLAN_NOT_ALLOWED)  
- ☐ DSGVO-Checks (Art. 11, Retention 180 Tage, keine PII in Logs)  
- ☐ Audit-Artefakte erzeugt (Logs, Reports, Diffs)  
- ☐ Performance-Ziele im Blick (p50/p95/p99)  
- ☐ Tests grün, Coverage ≥ 80 %  
- ☐ Contract-Tests grün  
- ☐ Terraform fmt + validate grün (EU-Only)  
- ☐ FinOps: cost_per_tenant plausibel, keine ungeklärten Kosten-Spikes  
- ☐ Commit nach Conventional Commits, PR-Beschreibung verlinkt CI-Run + Rollen  

---

## 16) Break-Glass-Verfahren (MUSS)

**Zweck:** Nur bei kritischen Security-Incidents oder massivem Betriebsstillstand.  

**Erlaubte Auslöser (Beispiele):**

- kompromittierter Key / Token  
- massiver Fraud / Replay-Angriff  
- Ausfall einer kritischen Region/Komponente  

**Freigabe:**

- Tech Lead **und** Audit-Officer (2-Personen-Prinzip)  

**Pflicht-Ablauf:**

1. Break-Glass-PR/Deployment mit klarer Begründung  
2. Ticket mit Label `break-glass`  
3. vollständiger Audit-Trail (Wer, Wann, Warum, Welche Änderung)  
4. Nacharbeiten ≤ 72h:
   - CI-Gates wieder herstellen  
   - technische Schulden dokumentieren  
   - ggf. Hotfix in regulären Prozess überführen  

Break-Glass ohne Ticket oder ohne Nacharbeiten → **Policy-Verstoß**.

---

## 17) CI-Gates (MUSS)

- Lint grün  
- Build grün  
- Tests grün, Coverage ≥ 80 %  
- Contract-Tests grün, `schema_drift = 0`  
- Anti-Replay-Paralleltests grün  
- Device-Proof-Tests (Positiv/Negativ) grün  
- Plan-Gate-Tests grün (Starter → 403 PLAN_NOT_ALLOWED)  
- OpenAPI-Lint grün  
- Terraform fmt + validate grün (EU-Region enforced)  
- GDPR-Checks grün (Art. 11, Retention 180 Tage, Logs ohne PII)  
- `contract-sync-frontend` (OpenAPI → Types/Client → Frontend-Build) grün  
- ggf. `gdpr-compliance.yml`, `security-gates.yml` grün  

Merge in `main` NUR, wenn alle required checks grün sind.

---

## 18) Aufgabenrezepte (für Codex-CLI)

### OpenAPI → Types

> „Generiere @lokaltreu/types aus OpenAPI und fixe Imports.“

- Rolle: Contract-Sheriff  
- Kontext: `apps/api/openapi/**`, `packages/types/**`  

### POST /stamps/claim implementieren

> „Implementiere POST /stamps/claim idempotent, Fehler RFC7807.“

- Rollen: Idempotency-Guardian, ProblemJSON-Arbiter, Audit-Officer  

### Anti-Replay-Paralleltest

> „10 parallele Claims, 1×201, 9×409.“

- Rollen: Idempotency-Guardian, Test-Pilot  

### Plan-Gate

> „Referral Starter → 403 PLAN_NOT_ALLOWED.“

- Rollen: ProblemJSON-Arbiter, Test-Pilot  

### Device-Proof

> „Validiere Ed25519-Proof über method|path|ts|jti.“

- Rolle: Device-Proof-Engineer  

---

## 19) Audit-Trail

Jeder Codex-Run MUSS gespiegelt werden:

```bash
... | tee -a artifacts/codex-$(date +%Y%m%d-%H%M%S).log
