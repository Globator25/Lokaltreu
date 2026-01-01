# Contract-Mapping – Schritt 12 (UI ↔ OpenAPI SSOT)

Ziel: Für jeden **Figma Screen** ist nachvollziehbar dokumentiert, ob/wie er durch eine **OpenAPI Operation** gedeckt ist.

Regeln:
- OpenAPI ist Single Source of Truth. Keine Felder/Endpunkte/Fehlercodes erfinden.
- Wenn Beispiele (examples) fehlen: **example missing** dokumentieren (Follow-up für Schritt 13 / Contract-Sheriff).
- Screens ohne API-Interaktion bekommen OpenAPI Operation = `—`.
- Mock-First Evidence (Prism) wird als Beleg genutzt, um Contract-Anforderungen (z. B. Required Header/Body) **zu verifizieren**, nicht um den Contract zu verändern.

## Mock-First Evidence (Prism)

- Prism Mock läuft lokal auf `http://127.0.0.1:4010`
- **Primary Evidence Log:** `artifacts/step-12-ux-uat/prism-20251222-084511.log`
- Nachgewiesen:
  - `GET /referrals/link` → `200 OK`
  - `POST /stamps/claim` **mit** `Idempotency-Key: uat-01-claim-0001` → `422 Unprocessable Entity`
    - `sl-violations`: **nur** `Body parameter is required`
    - **Keine** Violation mehr bzgl. fehlendem `idempotency-key` → Header-Anforderung ist erfüllbar/korrekt verstanden
    - Response: `application/problem+json` inkl. `error_code` und `correlation_id`

## Mapping-Tabelle

| Screen-ID | Flow | User-Intent | OpenAPI Operation | Request Example | Success Response | Error Cases | Notizen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Admin US-1 | Einstieg/Start in Admin-Flow | — | — | — | — | Navigation-only (CTA führt zu A2). |
| A2 | Admin US-1 | Konto/Registrierung starten | `registerAdmin` – `POST /admins/register` *(bitte in OpenAPI verifizieren)* | example missing | `201 Created` – example missing | `409 Conflict` → `TOKEN_REUSE` (Problem example `corr-conflict-001`) | **Contract Gap:** Request/Response examples fehlen. UI zeigt bei 409 verständliche Meldung, kein Fachjargon. |
| A3 | Admin US-1 | Business-Profil/Stammdaten erfassen | TBD – TBD *(OpenAPI suchen: Tenant/Business/Profile Update/Create)* | example missing / TBD | TBD | TBD | **TBD:** OperationId/Path fehlt im Mapping. Falls OpenAPI hierfür keinen Endpoint hat: als Contract Gap markieren (nicht “im UI erfinden”). |
| A4 | Admin US-1 | Erste Kampagne anlegen & aktivieren | TBD – TBD *(OpenAPI suchen: Campaign Create/Activate)* | example missing / TBD | TBD | TBD | **TBD:** OperationId/Path fehlt im Mapping. Falls OpenAPI keine Kampagnen-Operation hat: Contract Gap. |
| A5 | Admin US-1 | Erfolg/Übersicht nach Aktivierung | — | — | — | — | Nur UI-State basierend auf Ergebnis aus A4 (oder lokal). Max. 2 Next-Steps Links. |

| S1 | Staff | Startscreen mit exakt 2 Aktionen | — | — | — | — | Zwei Buttons: „Stempel vergeben“, „Prämie einlösen“. Keine API. |
| S2 | Staff – Stempel | Stempel verbuchen (Code/Token eingeben) | `claimStamp` – `POST /stamps/claim` | example missing | `200 OK` Example `rewardUnlocked`: `{ status: "claimed", stampId: "...", rewardUnlocked: true, referralAwarded: true, remainingToReward: 0, correlation_id: "corr-claim-ok-001" }` + Header `Idempotency-Key` | `400 TOKEN_EXPIRED` (`tokenExpired`) · `403 PLAN_NOT_ALLOWED` · `409 TOKEN_REUSE` · `422 SELF_REFERRAL_BLOCKED` · `429 RATE_LIMITED` | **Contract Gap:** Request example fehlt. **Prism Evidence (Primary):** `artifacts/step-12-ux-uat/prism-20251222-084511.log` zeigt: Request-Body ist required; `Idempotency-Key` ist required und **erfüllbar** (bei gesetztem Header bleibt nur „Body required“). **UI-Implikation:** Client muss Body + `Idempotency-Key` setzen; UI muss `application/problem+json` pro `error_code` in einfache Meldungen übersetzen. |
| S3 | Staff – Stempel | Erfolg nach Stempelvergabe | — | — | — | — | UI basiert auf Success Response aus S2. „Zurück“ führt zu S1. |
| S4 | Staff – Prämie | Prämie einlösen (Code/Token eingeben) | `redeemReward` – `POST /rewards/redeem` | example missing | `200 OK` Example `redeemSuccess`: `{ status: "redeemed", rewardId: "...", tenant_id: "...", device_id: "...", correlation_id: "corr-redeem-ok-001" }` + Header `Idempotency-Key` | `400 TOKEN_EXPIRED` · `401 deviceUnauthorized` · `403 PLAN_NOT_ALLOWED` · `409 TOKEN_REUSE` · `429 RATE_LIMITED` · `500 InternalServerError` (example missing) | **Contract Gap:** Request example fehlt; 500 example fehlt. UI zeigt bei 5xx generische Meldung. `Idempotency-Key` ist Pflicht (Header) – analog zu S2 muss der Client den Header setzen (kein „Erfinden“ im UI). |
| S5 | Staff – Prämie | Erfolg nach Einlösung | — | — | — | — | UI basiert auf Success Response aus S4. „Zurück“ führt zu S1. |

| E0 | Error States | Fehler-Hub zum gezielten Testen | — | — | — | — | UAT-Helfer: Buttons zu E1–E5. Rückweg zum Start-Hub. |
| E1 | Error States | Eingabefehler verständlich erklären | — | — | — | 422 (Problem+JSON) | Gilt als UI-Template für 422 aus A2/S2/S4. Keine technischen Begriffe im Titel. |
| E2 | Error States | Konflikt (z. B. Code schon benutzt) | — | — | — | 409 (Problem+JSON, z. B. `TOKEN_REUSE`) | Gilt als UI-Template für 409 aus A2/S2/S4. |
| E3 | Error States | Keine Berechtigung/kein Zugriff | — | — | — | 401/403 (Problem+JSON) | UI-Template für 401/403. |
| E4 | Error States | Zu viele Versuche / Rate Limit | — | — | — | 429 (Problem+JSON, Retry-After optional) | UI-Template für 429. |
| E5 | Error States | Technischer Fehler | — | — | — | 5xx (Problem+JSON falls definiert, sonst generisch) | UI-Template für 5xx. |

## Contract Gaps (nur dokumentieren, nicht in Schritt 12 ändern)

- `POST /admins/register`: Request/Response examples fehlen (example missing).
- `POST /stamps/claim`: Request example fehlt (example missing).
- `POST /rewards/redeem`: Request example fehlt (example missing); 500 example fehlt.
- Admin Stammdaten (A3): OpenAPI Operation TBD (falls nicht vorhanden → Contract Gap).
- Admin Kampagne (A4): OpenAPI Operation TBD (falls nicht vorhanden → Contract Gap).

> Hinweis: Alle Gaps sind Input für Schritt 13 (Expand-Contract / Contract-Sheriff Follow-ups). In Schritt 12 keine OpenAPI-Änderungen.
