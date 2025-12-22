# Runbooks – Lokaltreu

## Zweck & Scope
Dieser Index bündelt alle Betriebs-, Security- und Disaster-Recovery-Runbooks. Ziel ist ein auditierbares, PII-freies Nachschlagewerk für On-Call, Security Lead und Compliance, damit kritische Abläufe reproduzierbar bleiben.

## Übersicht
| Runbook | Link | Owner-Rolle | Last exercised |
| --- | --- | --- | --- |
| Incident & Breach Response | [Incident-Breach](./Incident-Breach.md) | Incident Commander | TODO |
| JWKS-Rotation | [JWKS-Rotation](./JWKS-Rotation.md) | Security Lead | TODO |
| JWKS-Rollback | [JWKS-Rollback](./JWKS-Rollback.md) | Security Lead | TODO |
| Restore (DB & Audit) | [Restore](./Restore.md) | Platform On-Call / DB Lead | TODO |
| Replay-Suspected | [Replay-Suspected](./Replay-Suspected.md) | Security Analyst | TODO |
| Blue-Green Deployment | [blue-green](./blue-green.md) | Platform On-Call | TODO |
| Standard Deployment | [deploy](./deploy.md) | Platform On-Call | TODO |
| Legacy Incident Flow | [incident](./incident.md) | Incident Commander | TODO |
| Restore (Legacy) | [restore-db](./restore-db.md) | DB Lead | TODO |
| Rollback (Legacy) | [rollback](./rollback.md) | Platform On-Call | TODO |
| Runbook Template | [_TEMPLATE](./_TEMPLATE.md) | Docs-Keeper | TODO |

## Break-Glass / Emergency Access
Break-Glass-Berechtigungen und Abläufe sind ausschließlich in `../AGENTS.md` (Abschnitt „Emergency Break-Glass Deployment“) definiert. Dieses README enthält keine alternativen Shortcuts und verweist nur auf die dortige Regelung.

## Evidence / Audit Trail
- **Nachweise sammeln:** Ticket-/Incident-ID, Timeline (UTC), correlation_id-Auszüge, Logs/Metric-Exports (PII-frei), Ergebnisse von Smoke-/Regressionstests, Signaturen/Hashes relevanter Artefakte.
- **Ablage:** Projektweites Ticket-System + `artifacts/<ticket-or-incident-id>/` (inkl. Unterordner pro Runbook-Ausführung); Offloading nach R2-Audit-Bucket gemäß `docs/04-Security-and-Abuse.md`.
- **Verantwortung:** Runbook-Owner pflegt die Sammelstelle, Audit-Officer kontrolliert Vollständigkeit während Reviews.
