# Runbook: <Titel>

> Break-Glass / Emergency Access: siehe AGENTS.

## Zweck & Scope
Kurzbeschreibung des Ziels und der Grenzen. Welche Systeme/Umgebungen, welche Risiken.

## Trigger/Erkennung
Beobachtbare Signale (Alerts, Tickets, Dashboards), wann das Runbook anzuwenden ist.

## Verantwortlichkeiten & Eskalation
Rollen (z. B. Incident Commander, Security Lead, DB Lead), Eskalationspfade, Kommunikationskanäle.

## Voraussetzungen/Prechecks
Listen der benötigten Artefakte, Zugriffe, Backups, Genehmigungen. Prüfschritte mit Ja/Nein.

## Schrittfolge
### Block 1 – <Name>
1. Aktion …
2. Aktion …
- **Verifikation:** Kriterien, Logs, Tests.

### Block 2 – <Name>
…

## Rollback
Bedingungen und Ablauf, wann und wie zurückgerollt wird. Referenz auf andere Runbooks falls relevant.

## Evidenz & Audit-Artefakte
Was sammeln (Dashboards, correlation_id, Tickets), wo ablegen (z. B. `artifacts/`, R2).

## Kommunikation
Interne/externe Kommunikationsschritte, Freigaben, Status-Page.

## Trockenlauf-Protokoll (Template)
| Zeit (UTC) | Schritt | Erwartung | Ergebnis | correlation_id |
| --- | --- | --- | --- | --- |
| HH:MM | | | | |
