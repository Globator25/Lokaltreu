# UAT-05 — Schritt 12 (UX/UI Prototyp + frühes UAT)

- Datum: 2025-12-__
- Session-ID: UAT-05
- Moderator: <Name>
- Tester: <Name / Rolle> (intern)
- Gerät/Setup: (z. B. Windows + Chrome / iPhone Safari / Android Chrome)
- Prototyp-Version: v0.2 – UAT-ready
- Figma Prototype Link: <aus docs/ux/step-12/README.md>
- Startpunkte: A1 (Admin), S1 (Staff)
- Prism Mock Evidence (optional): artifacts/step-12-ux-uat/prism-20251222-084511.log

## 1) Ziel der Session
Validieren, dass:
- Admin US-1 vollständig durchklickbar ist (A1→A5) und **ohne Hilfe** verstanden wird.
- Staff-Flows beide Aktionen verständlich sind (S1→S2→S3 und S1→S4→S5).
- Error States über UAT-Links testbar sind (E0→E1..E5) und Meldungen verständlich sind (kein Fachjargon).

## 2) Messwerte (Pflicht)
- Startzeit: __:__
- Endzeit: __:__
- Dauer gesamt (Minuten): __
- US-1 ohne Hilfe gelungen? (JA/NEIN): __
- Hilfe nötig? (JA/NEIN): __
- Anzahl Rückfragen: __
- Anzahl Fehlklicks/Umwege: __

## 3) Testablauf & Ergebnis

### 3.1 Admin US-1 (A1→A5)
- [ ] A1 verstanden (Einstieg) — PASS/FAIL: __
- [ ] A2 Registrierung gestartet — PASS/FAIL: __
- [ ] A3 Stammdaten erfasst — PASS/FAIL: __
- [ ] A4 Kampagne angelegt/aktiviert — PASS/FAIL: __
- [ ] A5 Erfolg verstanden („Was nun?“) — PASS/FAIL: __

**Zeit Admin-Flow (Minuten):** __  
**Notizen Admin:** __

### 3.2 Staff: Stempel vergeben (S1→S2→S3)
- [ ] S1 „2 Aktionen“ sofort verständlich — PASS/FAIL: __
- [ ] S2 Stempelvorgang verstanden (Code/Token) — PASS/FAIL: __
- [ ] S3 Erfolg/Bestätigung verständlich — PASS/FAIL: __

**Notizen Stempel:** __

### 3.3 Staff: Prämie einlösen (S1→S4→S5)
- [ ] S4 Einlösen verstanden — PASS/FAIL: __
- [ ] S5 Erfolg/Bestätigung verständlich — PASS/FAIL: __

**Notizen Prämie:** __

### 3.4 Error States (E0→E1..E5) via „Fehler simulieren“
- [ ] E1 (422) verständlich, handlungsorientiert — PASS/FAIL: __
- [ ] E2 (409) verständlich („Code schon benutzt“) — PASS/FAIL: __
- [ ] E3 (401/403) verständlich — PASS/FAIL: __
- [ ] E4 (429) verständlich + Retry-Hinweis — PASS/FAIL: __
- [ ] E5 (5xx) verständlich + „später erneut“ — PASS/FAIL: __

**Notizen Errors:** __

## 4) Pain Points (Pflicht) — inkl. Severity
Severity-Skala:
- S1 = kosmetisch (kein Impact)
- S2 = irritierend (kurzer Stop)
- S3 = blockierend (Flow kann nicht fortgesetzt werden)
- S4 = DoD-Blocker (US-1 ohne Hilfe scheitert / kritischer Flow unbenutzbar)

| # | Screen-ID | Beobachtung / Pain Point | Severity (S1–S4) | Vermutete Ursache | Fix-Idee (kurz) |
|---|-----------|---------------------------|------------------|-------------------|-----------------|
| 1 | __ | __ | __ | __ | __ |
| 2 | __ | __ | __ | __ | __ |
| 3 | __ | __ | __ | __ | __ |

## 5) Ergebnis der Session (Pflicht)
- Gesamtstatus: PASS / FAIL
- Begründung: __
- Wichtigster Fix (Top-1): __
