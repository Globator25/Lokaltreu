# Runbook: Incident Response

**Ziel:** Strukturierter Ablauf bei Sicherheits- oder Betriebsincidents.  
**Rollen:**  
- **Incident Commander (IC):** leitet, priorisiert, entscheidet.  
- **Scribe:** führt Timeline & Decision Log.  
- **Comms Lead:** interne/ externe Kommunikation.  
- **Tech Leads:** API/Web/DB/Infra.

## 0) Auslöser & Schweregrad
**Trigger:** SLO-Breach (p95/p99, 5xx, 429), Datenverlust, Sicherheitsverdacht, Prod-Outage.  
**Severity (Beispiel):**  
- **P1:** Kritischer Outage/Leak, >20% Nutzer betroffen.  
- **P2:** Degradierung, Workaround möglich.  
- **P3:** Teilfunktion defekt.  
- **P4:** Beobachtung/Minor.

> IC setzt Schweregrad und eröffnet Incident-Channel.

## 1) Erstklassifizierung
- IC, Scribe, Comms Lead benennen.  
- Scope / Impact / Startzeit klären.  
- Hypothese notieren, *keine* Schuldzuweisung.

## 2) Sofortmaßnahmen (Containment)
- Betroffene Dienste isolieren (Scale-down, Read-only, Feature-Flags).  
- Traffic drosseln / Canary zurückdrehen / Blue→Green zurückschwenken.  
- Zugang minimieren, Secrets rotieren **falls** Verdacht.  
- **Logging prüfen:** keine PII in neuen Logs.

## 3) Analyse
- Daten sammeln: Metriken, OTel-Traces, 4xx/5xx, Deploy-Diff, DB-Grafen.  
- Reproduktion im Staging/Dev versuchen.  
- Root-Cause-Hypothesen priorisieren, eine nach der anderen testen.

## 4) Remediation / Rollback
- **Rollback** auf letztes stabiles Artefakt, wenn P1/P2 oder Risiko hoch.  
- Hotfix/Config-Änderung mit minimalem Blast-Radius.  
- Nach jedem Schritt: Smoke-Tests (`/health`, Kernrouten dry-run), Metriken prüfen.

## 5) Kommunikation
- **Intern:** Incident-Channel öffnen, Status-Updates zeitgesteuert (z. B. alle 15–30 min bei P1/P2).  
- **Extern:** Statuspage nach Freigabe Comms Lead. Kundeninfo nur faktenbasiert.  
- **Stakeholder:** Management, Support, Datenschutz-Kontakt informieren.

## 6) Beweissicherung & Compliance
- Scribe sammelt Links: CI-Run, Artefakte, Logs, Dashboards, Tickets.  
- Relevante Rohdaten/Audit-Events unverändert sichern (WORM-Prinzip).  
- **DSGVO:** Bei Verdacht auf Personenbezug/Leak Datenschutz-Beauftragte*n einbinden; keine PII in Tickets/Chats posten.

## 7) Exit-Kriterien
- Service stabil (p95/p99 normal), 5xx/429 im Rahmen.  
- Ursache mitigiert oder zurückgerollt.  
- Smoke-Tests grün.  
- Comms aktualisiert, nächste Schritte geplant.

## 8) Postmortem (innerhalb 5 Werktagen)
- Faktenbasierte Timeline, Root Cause, Impact, Kosten.  
- „Five Whys“/Fishbone, Präventionsmaßnahmen (Owner, Termin).  
- Lernpunkte, Runbooks/Alarme/Tests aktualisieren.

---

## Anhänge
**Checkliste – 15-Minuten-Start:** IC benannt, Channel offen, Schweregrad gesetzt, Containment aktiv, Scribe loggt.  
**Decision Log (Beispiel):**
- `[HH:MM]` Maßnahme, erwarteter Effekt, Ergebnis, nächste Aktion.  
**Vorlagen:** Statuspage-Update, Kunden-FAQ, Management-Briefing.
