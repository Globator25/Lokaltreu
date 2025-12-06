# AGENTS – Governance

- Sentinel present

## Emergency Break-Glass Deployment

- **Zulässige Gründe**: Nur kritische Security-Lücke oder massiver Incident mit bestätigtem SLO-Bruch; Komfort- oder Feature-Druck zählt nicht.
- **Berechtigte Rollen**: Tech Lead + Audit-Officer (oder Contract-Sheriff) geben eine 2-Faktor-Freigabe und protokollieren diese im Incident-Log.
- **Ablauf**: PR mit `[BREAK-GLASS]` taggen → zwei Maintainer-Reviews → Admin-Merge → Entscheidung + Zeitstempel loggen → Follow-up-Ticket mit Checkliste erstellen.
- **Logging & Ticketing**: Ticket/Log enthalten Commit-SHA, Grund, Laufzeit und geplante Nacharbeiten; Audits müssen Zugriff auf diese Dokumentation haben.
- **Gates wiederherstellen**: Alle übersprungenen Gates (Lint, Build, Tests, Coverage ≥80 %, schema_drift = 0, GDPR, Security, Terraform EU-only) unmittelbar nachziehen und im Ticket abhaken; bis dahin kein weiterer Break-Glass.
