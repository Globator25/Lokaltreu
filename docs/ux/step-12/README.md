# Schritt 12 – UX/UI-Design & frühes UAT

## Ziel & DoD (Roadmap 2.3.1)
- **Ziel:** Kern-User-Flows (Admin-Onboarding < 5 Minuten, Mitarbeiter-UI mit genau zwei Aktionen) in Figma/Prototyp validieren und mit 3–5 Zielnutzer:innen testen.
- **Ergebnisse:** Prototyp, UAT-Protokolle, dokumentierte UX-Entscheidungen inkl. Schema-Auswirkungen.
- **DoD:** Alle Testpersonen schaffen US‑1 ohne Hilfe; Pain-Points priorisiert; mindestens ein Flow optional gegen Prism-Mock geprüft.

## Figma Prototyp

- Version: v0.2 – UAT-ready (2025-12-21)
- Figma File (View-only): https://www.figma.com/make/hcXW1h2fUvz8RE8NjIvCXz/High-Fidelity-Click-Prototype
- Prototype (Preview/Present): https://www.figma.com/make/hcXW1h2fUvz8RE8NjIvCXz/High-Fidelity-Click-Prototype?t=3cpXGOwwtMUF62Q4-20&fullscreen=1

### Startpunkte / Einstieg
- Einstieg Admin US-1: Hub → „01 Admin US-1“ → A1
- Einstieg Staff: Hub → „02 Staff“ → S1

### Hinweise
- UAT-Links „Fehler simulieren“ vorhanden (A2/A4/S2/S4 → E1/E2)
- Error Hub E0 vorhanden, E1–E5 erreichbar, „Zurück“ nutzt Back (History)

## Contract-Sheriff No-Gos
- Keine handgeschriebenen API-Typen im Frontend (`lokaltreu/no-manual-api-types`).
- Keine PII oder echten Produktionsdaten im Prototyp/UAT.
- Keine OpenAPI-Breaking-Changes in diesem Schritt.

## Preflight-Checkliste
1. `git status` ist sauber (keine uncommitted Changes).
2. Node.js (>= 20) und npm installiert (`node -v`, `npm -v`).
3. Prism-Mock starten: `npm run mock:api`.
4. OpenAPI→Types-Codegen: `npm run codegen:types`.
5. Prototyp/UAT ausschließlich mit Testdaten – **keine PII** verwenden.

## Artefakte & Links
- [UAT-Plan](./UAT-Plan.md)
- [UAT-Script](./UAT-Script.md)
- [UAT-Protocol-Template](./UAT-Protocol-Template.md)
- [UAT-Session-01](./UAT-Session-01.md)
- [UAT-Session-02](./UAT-Session-02.md)
- [UAT-Session-03](./UAT-Session-03.md)
- [UAT-Session-04](./UAT-Session-04.md)
- [UAT-Session-05](./UAT-Session-05.md)
- [Contract-Mapping](./Contract-Mapping.md)
- [Findings](./Findings.md)
- [Priorities](./Priorities.md)
- [UX-Decisions-Schema-Impact](./UX-Decisions-Schema-Impact.md)

## Figma Prototyp
- **Link:** _wird intern hinzugefügt_ (Zugriff nur für UX-Team; keine Weitergabe an externe Tester ohne NDA).
- **Benötigte Screens:**
  - **Admin US‑1:** Registrierung (A1), Stammdaten (A2), Kampagnen-Konfiguration (A3), Bestätigungs-/Success-Screen (A4).
  - **Mitarbeiter:** Vollbild-UI mit zwei Buttons (B1 Stempel, C1 Prämie) inkl. Success- und Error-States gemäß Contract-Mapping.
- **Regeln:** ausschließlich synthetische Daten, Pseudonyme, keine echten Geschäfts- oder Kundendaten.
- **Screen-ID-Konvention:** `A*` für Admin, `B*`/`C*` für Mitarbeiterflows – identisch zu Contract-Mapping und UAT-Protokollen.

## Optional: Prism-Mock Verprobung
- **Start:** `npm run mock:api` (laut AGENTS).
- **Flows zum Testen:** z. B. `claimStamp` (`POST /stamps/claim`) und `redeemReward` (`POST /rewards/redeem`) – siehe Contract-Mapping.
- **Evidence:** Logauszug oder Screenshot des Mock-Responses in `artifacts/step-12-ux-uat/` ablegen (keine PII, ggf. Response-IDs anonymisieren).

## Contract-Sheriff Safety Check
- OpenAPI → Types erfolgt ausschließlich via `npm run codegen:types`, generiert `packages/types/src/index.d.ts`.
- Schritt 12 ändert den Contract nicht; nach jedem Run wird `git status` bzw. `git diff` geprüft, um überraschende Diffs zu vermeiden.
- Falls doch Drift entsteht, erfolgt die Behandlung in einem separaten Ticket/Review (nicht ad-hoc während Schritt 12).

## Übergabe an Schritt 13 (Expand-Contract)
Alle UX-Entscheidungen mit Auswirkungen auf Domain- oder DB-Schema werden in [UX-Decisions-Schema-Impact](./UX-Decisions-Schema-Impact.md) dokumentiert und dienen als Input für Expand-Contract-Migrationen in Schritt 13.

## Verification
- **Commands:** `npm run lint`, `npm run build`, `npm test --workspaces -- --coverage` (bzw. projektweit relevante Jobs).
- **Erwartung:** Alle Checks laufen grün; keine UAT-Aktivität darf die bestehenden Gates brechen.
- **Done-Kriterium:** Schritt 12 gilt als abgeschlossen, wenn alle DoD-Punkte erfüllt sind, Evidence vorliegt (UAT-Sessions, Findings/Priorities, UX-Decisions) und keinerlei PII enthalten ist.

## DoD-Checkliste (abhaken)
- [ ] Figma/Prototyp deckt Admin US‑1 (< 5 Min) und Mitarbeiter-UI mit 2 Aktionen ab.
- [ ] 3–5 UAT-Protokolle (UAT-01..UAT-0X) ausgefüllt, PII-frei.
- [ ] Alle Testpersonen schaffen US‑1 ohne Hilfe (Nachweis in Protokollen).
- [ ] `Findings.md` und `Priorities.md` aus UAT abgeleitet.
- [ ] `UX-Decisions-Schema-Impact.md` erstellt (Hypothesen + Follow-ups für Schritt 13).
- [ ] Optionaler Prism-Mock-Flow verprobt, Evidence in `artifacts/step-12-ux-uat/`.
- [ ] Keine OpenAPI-Breaking-Changes / keine manuellen API-Typen (schema_drift = 0).
- [ ] Lint/Build/Tests (CI-Gates) sind grün.

### Mock-First Evidence (Prism)

- Prism gestartet: `npm run mock:api` (Port 4010)
- Evidence Log (Primary): `artifacts/step-12-ux-uat/prism-20251222-084511.log`

**Verifizierte Requests gegen den Mock:**
- `GET /referrals/link` → 200 OK
- `POST /stamps/claim` mit `Idempotency-Key: uat-01-claim-0001` → 422 Unprocessable Entity  
  - `sl-violations`: nur `Body parameter is required` (Header-Anforderung erfüllt; keine `idempotency-key`-Violation)
  - Response: `application/problem+json` inkl. `error_code` und `correlation_id`

  ### Quality Gates (lokal)

- `npm run lint` ✅
- `npm run build` ✅
- `npm -w apps/api test -- --coverage` ✅ (Coverage ~82% statements)
- `npm -w apps/web test` ✅ (Placeholder: Roadmap Schritt 27/37)
- Hinweis: Lokale FinOps-Env-Warnungen in Tests sind erwartbar (keine Failures).
