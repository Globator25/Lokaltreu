# AGENTS – Governance

- Sentinel present

## Emergency Break-Glass Deployment

- Zulässige Gründe MUSS auf kritische Security-Lücken oder massive Incidents mit SLO-Bruch begrenzt sein; Komfort- oder Feature-Wünsche zählen nicht.
- Break-Glass MUSS durch den Tech Lead plus Audit-Officer oder Contract-Sheriff gemeinsam freigegeben werden; eine zweite Bestätigung (2-Faktor-Freigabe) ist Pflicht.
- Ablauf MUSS: PR mit `[BREAK-GLASS]` kennzeichnen, zwei Maintainer:innen approven, Admin-Merge durchführen, automatisches Follow-up-Ticket akzeptieren und dort die Nacharbeiten dokumentieren.
- Nach dem Merge MUSS das Team alle CI-Gates wiederherstellen: Coverage ≥ 80 %, schema_drift = 0, GDPR-Checks, Security-Gates (Anti-Replay, Device-Proof, Plan-Gate) sowie Terraform fmt+validate EU-only.
- Jede Abweichung SOLL innerhalb eines Werktags als Incident-Report dokumentiert werden; bis alle Punkte abgeschlossen sind, darf kein weiterer Break-Glass erfolgen.
