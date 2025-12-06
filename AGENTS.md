# AGENTS – Governance

- Sentinel present

## Emergency Break-Glass Deployment

- Zulässige Gründe MUSS auf kritische Security-Lücken oder massive Incidents mit bestätigtem SLO-Bruch begrenzt bleiben; Feature- oder Komfortdruck gilt nicht.
- Freigabe MUSS durch mindestens zwei Maintainer:innen erfolgen (Tech Lead plus Audit-Officer oder Contract-Sheriff) und als 2-Faktor-Freigabe im Incident-Log dokumentiert werden.
- Ablauf MUSS: PR mit `[BREAK-GLASS]` kennzeichnen, zwei Maintainer-Reviews einholen, Admin-Merge durchführen, Break-Glass-Entscheidung inkl. Zeitstempel loggen und ein Follow-up-Ticket mit Checkliste erstellen.
- Ticket und Log MUSS Commit-SHA, Grund und Laufzeit enthalten; Nacharbeiten SOLL im Ticket verlinkt und mit Audit-Officer abgestimmt werden.
- Nach dem Merge MUSS jedes übersprungene Gate nachgezogen werden: Lint/Build/Tests, Coverage ≥ 80 %, schema_drift = 0, GDPR-Checks, Security-Gates (Anti-Replay, Device-Proof, Plan-Gate) sowie Terraform fmt+validate EU-only.
- Bis sämtliche Nacharbeiten dokumentiert und geschlossen sind, DARF kein weiterer Break-Glass erfolgen; Verstöße SOLL ein Post-Incident-Review adressieren.
