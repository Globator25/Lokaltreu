## Personenbezug in Logs
- Standardmäßig werden keine Klarnamen oder Kundendaten protokolliert.
- Korrelation erfolgt über `correlation_id`, `tenant_id` und Trace-IDs; diese gelten als pseudonymisierte Kennungen.
- Zugriff auf Korrelationstabellen ist auf das On-Call-/SRE-Team beschränkt und wird revisionssicher protokolliert.

## Rechtsgrundlage
- Verarbeitung stützt sich auf Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Stabilität, Fehlersuche, Missbrauchserkennung).
- Die Interessenabwägung ist im Verzeichnis der Verarbeitungstätigkeiten dokumentiert und wird jährlich überprüft.

## Art. 11 DSGVO – Identifizierung nur bei Bedarf
- Observability-Daten werden ohne direkten Personenbezug verarbeitet.
- Re-Identifizierung ist nur nach Freigabe der Datenschutzbeauftragten zulässig und erfordert: Ticket-Referenz, schriftlichen Antrag, dokumentierte Freigabe.
- Jeder Zugriff auf Rohdaten wird in einem WORM-Audit-Trail festgehalten.

## Aufbewahrung & Löschung
- Logs, Alerts und Traces werden 180 Tage vorgehalten (Richtlinie OBS-RET-01).
- Automatische Löschung erfolgt nach Fristablauf; Ausnahmen benötigen dokumentierte Genehmigung.
- WORM-Audit-Daten werden separat gespeichert und unterliegen eigenen Aufbewahrungsfristen.

## EU-Betrieb
- Tempo, Loki und Grafana laufen in EU-Rechenzentren (Fly.io Region FRA).
- Datenverarbeitung und Speicherung erfolgen ausschließlich in der EU; es findet keine Drittlandübermittlung statt.
