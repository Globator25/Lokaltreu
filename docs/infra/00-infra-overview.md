# Infra & Compliance Artefakte – Überblick

| Artefakt | Status | Rolle / Beschreibung |
| --- | --- | --- |
| `infra/terraform/` (inkl. `main.tf`, `providers.tf`, `variables.tf`, `modules/`) | vorhanden | Basis-IaC aus dem Bootstrap: definiert das EU-only Terraform-Setup (Fly.io, Neon, Upstash, Cloudflare, Mailjet) und stellt den Einstiegspunkt für weitere Module/Workspaces dar. |
| `compliance/AVV.md` | vorhanden | Auftragsverarbeitungsvertrag mit Subprozessor- und Retention-Übersicht – spiegelt Infrastruktur-Entscheidungen für Mandanten wider. |
| `compliance/TOMs.md` | vorhanden | Maßnahmenkatalog (Security, Logging, Provider-Kontrollen) – knüpft IaC-Governance an konkrete Controls (z. B. WORM, Region-Gates). |
| `compliance/ROPA.md` | vorhanden | Verarbeitungstätigkeiten mit System-/Provider-Zuordnung – dient als Brücke zwischen SaaS-Prozessen und IaC-Umsetzung. |
| `compliance/DPIA.md` | vorhanden | Datenschutz-Folgenabschätzung inkl. Provider-Risiken und Retention (180 Tage WORM) – informatives Gegenstück zu Terraform-Entscheidungen. |
| `compliance/Retention-Policy.md` | vorhanden | Beschreibt Aufbewahrung/Löschung (Neon, R2, Mailjet) und verweist auf IaC-Automatisierung (Lifecycle, Tombstone). |
| `compliance/Infos-DE.md` | vorhanden | Informationsblatt (Datenschutz) – nicht Kern-IaC, aber ergänzt Compliance-Scope. |
| `AGENTS.md` (Root) | vorhanden | Governance-Datei für Lokaltreu: definiert Rollen, CI-Gates, EU-/PWA-Leitplanken und ist Referenz für IaC-Änderungen (z. B. Terraform-Gates, Break-Glass). |

Stand: aktuelle Repo-Struktur; fehlende Artefakte wurden nicht entdeckt.
