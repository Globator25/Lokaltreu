# Runbook: Incident Response

**Ziel:** Strukturierter Ablauf bei Sicherheits- oder Betriebsincidents (SLO-Breach, 5xx/429-Spike, Datenverlust, Security-Verdacht).  
**Rollen:** Incident Commander (IC), Scribe, Comms Lead, Tech Leads (API/Web/DB/Infra).

---

## 0) Auslöser & Severity
- Trigger: p95/p99 SLO-Verletzung, Fehlerrate, Outage, Security-Alarme, Datenverlust.  
- Severity (P1–P4) nach Impact/Eskalation definieren (P1 = kritischer Outage/Leak).  
- IC setzt Severity, eröffnet Incident-Channel, ruft Runbook auf.

---

## 1) Erstklassifizierung
- IC, Scribe, Comms Lead benennen.  
- Scope, Impact, Startzeit, betroffene Regionen (immer EU) dokumentieren.  
- Erste Hypothese sammeln, keine Schuldzuweisungen.

---

## 2) Sofortmaßnahmen (Containment)
- Dienste isolieren (Scale-down, Read-only, Feature-Flags deaktivieren).  
- Traffic drosseln, Canary zurückdrehen, ggf. Blue→Green switchen.  
- Zugänge minimieren, Secrets rotieren falls Verdacht.  
- Logging prüfen: keine PII, WORM-Audit intakt.

---

## 3) Analyse
- Daten sammeln: OTel-Metriken, Traces, Logs, Deploy-Diffs, DB-Metriken.  
- Incident-Board aktualisieren (Hypothesen, Beweise).  
- Reproduktion auf Stage/Dev.  
- Hypothesen nacheinander testen, Ergebnisse im Decision Log festhalten.

---

## 4) Remediation / Rollback
- Bei P1/P2 sofort Rollback auf letztes stabiles Artefakt (siehe `runbooks/blue-green.md`).  
- Hotfix oder Konfigänderung nur mit minimalem Blast-Radius.  
- Nach jedem Schritt: Smoke-Tests (`/health`, `/stamps/claim` test-mode, `/rewards/redeem` dry-run), Observability prüfen.  
- Wenn Break-Glass nötig: AGENTS §5 beachten, Ticket + Audit-Eintrag.

---

## 5) Kommunikation
- Intern: Incident-Channel, Updates alle 15–30 Min (P1/P2).  
- Extern: Statuspage/Customer Comms nur nach Comms-Lead-Freigabe; faktenbasiert.  
- Stakeholder: Management, Support, Datenschutzbeauftragte informieren.

---

## 6) Beweissicherung & Compliance
- Scribe sammelt Links (CI-Run, Artefakte, Logs, Dashboards, Tickets).  
- Rohdaten/Audit-Events unverändert sichern (WORM), Export nach R2.  
- Verdacht auf Personenbezug → Datenschutz-Officer (Art. 33/34).  
- Keine PII in Tickets/Chats; Use correlation_id.  
- Document cost_per_tenant Auswirkungen (FinOps).

---

## 7) Exit-Kriterien
- Service stabil (p95/p99 normal, 5xx/429 im Rahmen).  
- Ursache mitigiert oder zurückgerollt; Monitoring normalisiert.  
- Smoke-Tests grün; Comms aktualisiert, nächste Schritte geplant.  
- Incident-Channel geschlossen nach Freigabe IC.

---

## 8) Postmortem (≤5 Werktage)
- Faktenbasierte Timeline, Root Cause, Impact, Kosten, SLO-Auswirkung.  
- „Five Whys“/Fishbone, Maßnahmen mit Owner & Termin.  
- Update Runbooks, Alerts, Tests.  
- Dokumentation in `docs/postmortems/`.

---

## Anhänge
- **15-Minuten-Startcheckliste:** IC benannt, Severity gesetzt, Channel offen, Containment aktiv, Scribe loggt.  
- **Decision-Log:** `[HH:MM] Aktion, Erwartung, Ergebnis, next`.  
- **Vorlagen:** Statuspage-Update, Kunden-FAQ, Management-Briefing.  
- **Referenzen:** `docs/runbooks/blue-green.md`, `docs/CI-Gates.md`, `docs/05-Compliance.md`.
