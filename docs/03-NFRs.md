# Nicht-funktionale Anforderungen (NFRs) – Lokaltreu

Dieses Dokument beschreibt die verbindlichen technischen Qualitätsziele für das Lokaltreu-System. Quellen: [SPEC §6–§9, §12–§15, §19], [ARCH], [ROADMAP 2.3.1], [AGENTS §6–§8].

---

## 1. Performance-Ziele

- **p50 ≤ 500 ms**  
- **p95 ≤ 3000 ms**  
- **p99 ≤ 6000 ms**  
Gilt je öffentliche Route (API und PWA) und wird regelmäßig via Lasttests (Roadmap Schritt 41) verifiziert.  
_Quelle: [SPEC §6.2], [SPEC §19.1], [ROADMAP Schritt 41]_

---

## 2. Verfügbarkeit (SLO)

- **99,90 % Verfügbarkeit über 30 Tage**  
Scope: `/stamps/claim`, `/rewards/redeem`; Monitoring über SLO-Dashboards (Schritt 47).  
_Quelle: [SPEC §6.2], [ARCH], [ROADMAP Schritte 8, 47]_

---

## 3. Resilienz & Wiederherstellung

- **RPO 15 Min**, **RTO 60 Min** (Multi-AZ, kontinuierliche Backups, Restore-Runbooks).  
- Blue-Green-Deployments mit getesteten Rollbacks (Schritt 46).  
- „Restore + Tombstone"-Pfad stellt Art.-11-Konformität sicher (Schritt 48).  
_Quelle: [SPEC §6], [SPEC §20], [ROADMAP Schritte 41, 46, 48]_

---

## 4. Security & Abuse-Prevention

- Anti-Replay via Redis `SETNX(jti)` + TTL=60 s für QR-Token und Redeem-Tokens.  
- Device-Proof: Ed25519-Signaturprüfung mit Zeitfenster ±30 s.  
- Rate-Limits: tenant 600 rpm, IP anonym 120 rpm, /stamps/claim 30 rpm/Card, /rewards/redeem 10 rpm/Device, Referral Velocity ≤ 5/Monat.  
- Audit-Events WORM (Retention 180 Tage) inkl. Signatur-Export.  
_Quelle: [SPEC §7], [SPEC §14–§16], [AGENTS §6], [ROADMAP Schritte 37–43]_

---

## 5. Daten- & DSGVO-Anforderungen

- Endkunden bleiben anonym/pseudonym; Logs enthalten nur tenant_id, device_id, card_id.  
- Retention: 180 Tage, danach Export + Löschung resp. Tombstone.  
- DSR über Art.-11-Prozess (PWA UI, Schritt 34) ohne zusätzliche Identifizierung.  
- Backups verbleiben in EU-Regionen; Restore respektiert deleted_subjects-Tabelle.  
_Quelle: [SPEC §8], [AGENTS §1, §9], [ROADMAP Schritte 2, 34, 48]_

---

## 6. PWA-Budgets & Caching

- **LCP ≤ 2,5 s**, **INP ≤ 200 ms**, **CLS ≤ 0,1** (mobile Fokus).  
- Service Worker: `stale-while-revalidate` (Static Assets), `network-first` (API).  
- Lighthouse ≥ 90, Installability „yes“.  
_Quelle: [SPEC §12], [ARCH], [ROADMAP Schritte 33–35]_

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
