# Schritt 22 – Plan-Enforcement (Spezifikation)

Diese Spezifikation beschreibt das Plan-Enforcement-Modul für Lokaltreu (Schritt 22).  
Sie ist DoD-orientiert, auditierbar, tenant-scoped und strikt OpenAPI-/SPEC-konform.

Bei Widersprüchen gilt: SPEC → OpenAPI → ARCH → AGENTS → Code.


## 1. Plan-Quelle (tenant-scoped)

- Jeder Plan-Check ist strikt an `tenant_id` gebunden.
- Keine Cross-Tenant-Leaks über Fehlermeldungen.
- `plan_code` wird serverseitig bestimmt (starter|plus|premium).
- Jede Entscheidung (Allow/Deny/Warn) ist mit `correlation_id` verknüpft.
- Keine PII in Fehlermeldungen.

---

## 2. PlanCounter-Modell (persistent, pro Tenant + Periode)

Für jede `tenant_id` und Abrechnungsperiode existiert ein persistenter Datensatz:

| Feld             | Bedeutung |
|------------------|----------|
| `stamps_used`    | Anzahl erfolgreicher Stempel in der Periode (nur committed) |
| `stamps_limit`   | deterministisches Limit (nicht 0/NULL) |
| `devices_allowed`| max. erlaubte aktive Geräte |
| `period_key`     | z. B. `YYYY-MM` (UTC) |
| `devices_active` | authoritative aus Device-Daten (optional als Cache) |

Periode: monatlich (Default UTC-Kalendermonat).  
Timezone-basierte Perioden sind später additiv möglich.

---

## 3. Soft-Limits für Stempel

- **≥ 80 %**: Warnsignal (Mail + UI-Banner)
- **≥ 100 %**: kein Block — Claim bleibt erfolgreich  
  → nur Upgrade-Signal
- Dedup-Regel: max. **1×/24 h** pro Tenant & Schwelle
- Dedup-Store darf Hot-Routes nicht blockieren (best effort)

Wiederholte Requests/Idempotency-Replays erzeugen **keine Warn-Spam**.

---

## 4. Feature-Gates (Plan-abhängig)

### Referral-Gate (verpflichtend)

| Plan | Verhalten |
|------|----------|
| starter | serverseitig blockiert |
| plus/premium | erlaubt |

Gilt für:

- `GET /referrals/link`
- Referral-Zweig in `POST /stamps/claim` (wenn `ref` gesetzt ist)

### Offers/Campaigns

Gate-Mechanismus existiert, Regeln werden später ergänzt.

---

## 5. Geräte-Limits

- Enforcement-Point: `POST /devices/register/confirm`
- Bedingung: `active_devices_count < devices_allowed`
- Bei Überschreitung:

403 application/problem+json
error_code = PLAN_NOT_ALLOWED


Tenant-Binding zwingend — kein Cross-Tenant-Geräte-Mapping.

---

## 6. Audit-Events (WORM-fähig, ohne PII)

Es werden Events protokolliert (mindestens):

- `plan.feature.blocked`
- `plan.limit.warning_emitted`
- `plan.limit.upgrade_signal_emitted`
- `plan.device_limit.blocked`
- `plan.upgrade.intent_recorded` (falls vorhanden)

Pflichtfelder (mindestens):

tenant_id, correlation_id, route, feature_or_limit,
plan_code, period_key, usage_percent, result, ts


Block-Events müssen zuverlässig persistiert werden; Warnungen können async/batched sein.

---

## 7. Fehlerformat (RFC 7807 – Problem+JSON)

- Content-Type: `application/problem+json`
- HTTP Status: **403**
- `error_code = PLAN_NOT_ALLOWED`
- `correlation_id` ist Pflicht
- `type` und `title` konsistent (plan/not-allowed)

Keine undokumentierten Fehlerformate oder Statuscodes.

---

## 8. Idempotenz / Anti-Replay

- Gleicher Idempotency-Key → gleiche Antwort
- Plan-Checks laufen **vor** irreversiblen Aktionen
- Replay-Schutz bleibt erhalten
- Referral-Block bleibt deterministisch tenant-scoped

---

## 9. Mandanten-Isolation

- Fehlermeldungen enthalten keine fremden Tenant-Infos
- Alle Cache/Dedup-Keys enthalten `tenant_id`

---

## 10. Nicht-funktionale Anforderungen

- O(1)-Reads in Hot-Routes
- Keine PII in Logs
- Redis-Ausfall → graceful degradation
- Metriken mindestens:

plan_usage_percent
plan_warning_emitted_total{threshold}
plan_feature_blocked_total{feature}
plan_device_limit_blocked_total
time_to_upgrade_effective (optional)


---

## Akzeptanzkriterien (Kurzfassung)

- Starter → `/referrals/*` = **403 PLAN_NOT_ALLOWED**
- Starter → Claim mit `ref` = **403**
- Plus/Premium → Referral erlaubt
- ≥ 100 % Stempel → **kein Block**
- 80 %/100 % → deduplizierte Warnsignale
- Device-Limit blockiert sauber
- Idempotenz bleibt stabil
- Responses entsprechen OpenAPI-Problem-Schema

---

## Guardrails (No-Gos)

- keine ad-hoc JSON-Errors
- keine Breaking-Changes
- keine PII-Logs
- keine versteckten Blocks bei Soft-Limits
- kein Code außerhalb zentraler Enforcement-Points

---

## Offene Punkte / Annahmen

1. 403-Responses wurden additiv in OpenAPI ergänzt  
2. Upgrade-Hinweis aktuell nicht Teil der Claim-Response  
3. Fail-open vs. fail-closed Policy für Plan-Store entscheidet Business

## Implementierungsstatus (Stand: 07.01.2026)

- Plan-Gate Middleware umgesetzt (plan-gate.ts).
- Referral-Handler und Claim-Handler nutzen Plan-Gates.
- Soft-Limit-Logik für Stempel implementiert (79/80/100 %, dedupliziert).
- Device-Limit bei /devices/register/confirm implementiert.
- Tests:
  - tests/plan/plan-gate-referrals.spec.ts
  - tests/plan/plan-gate-claim-referral.spec.ts
  - tests/plan/plan-soft-limits.spec.ts
  - tests/plan/plan-device-limit.spec.ts
- Alle genannten Tests grün.


