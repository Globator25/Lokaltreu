# Retention Policy

Version: 0.9 (Draft) • Owner: Audit-Officer • Referenzen: [docs/infra/providers-eu.md](../docs/infra/providers-eu.md), [docs/lokaltreu-spec.md](../docs/lokaltreu-spec.md), [docs/04-Security-and-Abuse.md](../docs/04-Security-and-Abuse.md)

## Scope
- Aufbewahrungs- und Löschvorgaben für alle Datenklassen in Lokaltreu.
- Sicherstellung, dass alle Provider (Fly.io, Neon, Upstash, Cloudflare R2/CDN, Mailjet) ausschließlich EU-Datenhaltung nutzen und WORM-/180-Tage-Regeln einhalten.

## 1. Datenklassen & Fristen

| Datenklasse | Systeme / Provider | Zweck | Aufbewahrung | Lösch-/Anonymisierungspfad |
| --- | --- | --- | --- | --- |
| Mandantendaten (Admin-Profile, Kampagnen, Planstatus) | Neon PostgreSQL (EU), Fly.io Runtime | Vertragsdurchführung, Planverwaltung | Laufzeit des Mandats + 30 Tage Grace nach Kündigung | Admin löst Kündigung → automatisierte Deprovisionierung → Neon-Records gelöscht, Backups folgen Schedule; Fly.io Sessions verfallen ≤ 30 Min. |
| Geräte-/Device-Bindungen | Neon PostgreSQL, Fly.io | Geräteverwaltung, Device-Proof | Aktiver Status; nach Sperrung sofortige Löschung + Audit-Event | Sperre über Admin-UI → Device-Eintrag gelöscht → Audit `device.removed` 180 Tage in WORM. |
| Loyalty-Transaktionen (Stempel, Rewards, Referral) | Neon PostgreSQL, Upstash Redis | Abwicklung Treueprogramm | Aktive Kampagne; nach Abschluss oder Kündigung + 30 Tage | Redis Tokens TTL ≤ 60 s / 24 h; finale Transaktion in Neon gelöscht, Audit verbleibt 180 Tage. |
| Audit- und Sicherheitsereignisse | Neon WORM-Tabellen + Cloudflare R2 (EU Jurisdiction) | Nachvollziehbarkeit, Abuse-Bekämpfung | 180 Tage verpflichtend (Roadmap & Spec) | Tägliche Export-Jobs nach R2 (signiert). Nach 180 Tagen automatische Löschung + Protokoll; Restore-Szenarien wenden `deleted_subjects` an. (siehe [docs/infra/01-providers.md](../docs/infra/01-providers.md)) |
| Reporting & Observability | Cloudflare R2 (Reporting), Fly.io OTel Collector | KPI-Analysen, FinOps, Performance | Standard 12 Monate (Reporting), 90 Tage (OTel), kein PII | Lifecycle-Rules auf R2; OTel-Metriken automatisch rotiert; nur pseudonyme IDs. |
| Terraform-State / Backups | Cloudflare R2 WORM, Neon Backups | Betriebszwecke, DR | Terraform-State bis Ersetzung durch neue Version, Audit-Snapshots 180 Tage | Rotation per Pipeline; alte State-Dateien gelöscht sobald neue Version aktiv. |
| Transaktionale E-Mails (Security/Plan) | Mailjet (EU) / Brevo Fallback | Alerts, Plan-Warnungen | Provider-Logs ≤ 30 Tage, Audit-Kopie 180 Tage | Mail-Inhalte nicht persistent gespeichert; Audit-Events pro Versand sichern Nachweis. |

## 2. Durchsetzung & Automatisierung
- **Terraform / IaC**: Region-Validierungen erzwingen EU-Provider; Lifecycle-Regeln (R2 WORM 180 Tage, Reporting 12 Monate).
- **Application Layer**: Kündigungstrigger löscht Tenant-Ressourcen + erstellt Tombstone-Eintrag (`deleted_subjects`). Restore-Verfahren spielen Tombstones erneut ein (Roadmap Schritt 48) – Backups/WORM-Exporte liegen ausschließlich in Cloudflare R2 (EU Jurisdiction, vgl. Provider-Matrix) mit Object-Lock.
- **CI-Gates**: `gdpr-compliance` prüft Existenz der Retention-Policy; Tests decken Art.-11-DSR-Flows ab.
- **Audits**: Export-Hashes in Cloudflare R2 dokumentiert; Nachweise in `docs/evidence/` spiegeln Einhaltung der Fristen ohne personenbezogene Beispiele.

## 3. Review & Ownership
- Audit-Officer verantwortet Policy, Infra-Engineer den technischen Vollzug (Lifecycle-Rules, Backups).
- Quartalsweises Review oder bei Provider-/Featureänderungen.
- Verstöße werden als Incident behandelt (Runbook `Incident-Breach.md`), inklusive sofortiger Datenbereinigung und Dokumentation für 180 Tage im WORM-Log.
