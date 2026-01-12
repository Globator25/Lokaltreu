# Nicht-funktionale Anforderungen (NFRs) – Lokaltreu

Dieses Dokument beschreibt die verbindlichen technischen Qualitätsziele für das Lokaltreu-System gemäß [DOC:SPEC §9], [DOC:ARCH], [DOC:REQ §6].

---

## 1. Performance-Ziele

- **p50 ≤ 500 ms**  
- **p95 ≤ 3000 ms**  
- **p99 ≤ 6000 ms**  
Diese Werte gelten je Route und werden regelmäßig durch Lasttests überprüft.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 2. Verfügbarkeit (SLO)

- **99,90 % Verfügbarkeit über 30 Tage**  
Gilt für die Kern-Routen `/stamps/claim` und `/rewards/redeem`.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 3. Resilienz-Ziele

- **RPO (Recovery Point Objective): 15 Minuten**  
- **RTO (Recovery Time Objective): 60 Minuten**  
Erreicht durch Multi-AZ, Backups, Restore-Protokolle und Canary-Releases.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 4. PWA-Budgets

- **LCP ≤ 2,5 Sekunden** (Largest Contentful Paint)  
- **INP ≤ 200 ms** (Interaction to Next Paint)  
- **CLS ≤ 0,1** (Cumulative Layout Shift)  
Diese Werte sichern ein schnelles und stabiles Nutzererlebnis auf mobilen Geräten.  
_Quelle: [DOC:SPEC §12], [DOC:ARCH]_

---

## 5. Caching-Strategie

- **stale-while-revalidate** für statische Inhalte  
- **network-first** für API-Aufrufe  
Implementiert über Service Worker in der PWA.  
_Quelle: [DOC:SPEC §12], [DOC:ARCH]_

---

## 6. Datenschutz & Aufbewahrung

- Endkunden bleiben anonym/pseudonym; Logs enthalten nur tenant_id, device_id, card_id.  
- Retention: 180 Tage, danach Export + Löschung resp. Tombstone.  
- DSR über Art.-11-Prozess (PWA UI, Schritt 34) ohne zusätzliche Identifizierung.  
- Backups verbleiben in EU-Regionen; Restore respektiert deleted_subjects-Tabelle.  
_Quelle: [SPEC §8], [AGENTS §1, §9], [ROADMAP Schritte 2, 34, 48]_

---

## 7. Observability & Alerts

- OpenTelemetry für API & PWA (Tracing + Metriken).  
- Pflichtmetriken: p50/p95/p99 per Route, error_5xx_rate, rate_token_invalid, rate_token_reuse, 429_rate, plan_usage_percent, cost_per_tenant.  
- Alerts: SLO-Breach, Fehlscan-Spike >5/60 s/Tenant, Kostenanomalien, Queue-Backlog.  
- correlation_id in allen Problem+JSON-Responses.  
_Quelle: [SPEC §19.1], [ROADMAP Schritte 8, 37, 47]_

---

## 8. Qualitätssicherung & CI-Gates

- Coverage ≥ 80 % (lines/func/branches/statements).  
- schema_drift = 0, Contract-Sync grün (OpenAPI SSOT).  
- Anti-Replay Paralleltest (1×201, 9×409) Pflicht pro Release.  
- Plan-Gates: Starter → 403 PLAN_NOT_ALLOWED testweise belegt; Referral-Funktionen deaktiviert nach Downgrade.  
_Quelle: [AGENTS §6–§7], [SPEC §19.2], [ROADMAP Schritte 37–42]_

---

## 9. FinOps & Kostenkontrolle

- cost_per_tenant als Leitmetrik; Ziel: konstante oder sinkende Kosten je aktivem Mandanten.  
- Alerts bei Abweichungen > 15 % pro Woche.  
- Reporting von DB-Storage, Redis-Operationen, CDN-Traffic zur Optimierung der Budgets aus SPEC (Hosting, Storage, Mail).  
_Quelle: [SPEC Kostenübersicht], [ROADMAP Schritte 8, 25, 47, 48]_

## UX Prototyping & frühes UAT (Schritt 12)
Schritt 12 liefert frühe Evidenz, ob die NFR-Annahmen (p95 ≤ 3s, radikale Einfachheit) im Prototyp standhalten. Verweise: [docs/ux/step-12/README.md](./ux/step-12/README.md) für Setup/Artefakte und [UX-Decisions-Schema-Impact](./ux/step-12/UX-Decisions-Schema-Impact.md) für Auswirkungen auf Domain & Schema.
