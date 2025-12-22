# Ticket: FinOps-Baseline auf Basis EU-Provider (dev-Umgebung, ~100 Händler, ~40k Endkunden)

## Hintergrund
- Aktuelle Infrastruktur (siehe `docs/infra/01-providers.md` / `docs/infra/providers-eu.md`) nutzt ausschließlich EU-Provider: Fly.io/Render (App), Neon (Postgres), Upstash (Redis), Cloudflare R2/CDN, Mailjet.
- Dev-Zielgruppe laut Spezifikation: ca. 100 Händler, 40 000 Endkunden, Fokus auf EU-DSGVO-Konformität.
- Roadmap fordert langfristig FinOps-Kennzahlen wie `cost_per_tenant`, `cost_per_active_user`, sowie Reporting über Infrastruktur-Kostenblöcke und Alerts (z. B. Roadmap Schritte 8, 47).

## Zielsetzung (dieses Ticket)
1. Grobe **Kostenschätzung** für die dev-Umgebung auf Basis der genannten EU-Provider erstellen (Listenpreise, erwartete Nutzung durch ~100 Händler).
2. **Reporting-Konzept (Skizze)** erarbeiten: Welche Kennzahlen (z. B. R2-Storage-Kosten, Fly.io-Ingress, Neon-Compute) sollen in künftigen FinOps-Dashboards auftauchen? Welche Datenquellen (Provider-APIs, Cloudflare Analytics, Neon Metrics) stehen zur Verfügung?
3. Outcome: Dokumentiertes Baseline-Dokument (Markdown) als Grundlage für spätere Observability-/FinOps-Schritte. **Keine** Umsetzung in IaC, kein Deployment.

## Nicht-Ziele
- Keine Änderungen am bestehenden Terraform/IaC.
- Kein produktives Tracking oder automatisiertes Reporting im Rahmen dieses Tickets.
- Keine Budgetfreigaben oder Vertragsänderungen – rein analytisch.

## Akzeptanzkriterien
- [ ] Dokument beschreibt Annahmen (100 Händler, 40 000 Endkunden) und listet die genutzten Provider inkl. EU-Regionen.
- [ ] Enthält eine nachvollziehbare Kostenschätzung (Bandbreiten) für jeden Provider, ohne konkrete Rechnungen/Secrets.
- [ ] Skizziert ein Reporting-Konzept (z. B. monatliche Kosten je Provider, Kennzahl `cost_per_tenant`, Alerts bei Abweichungen > X %).
- [ ] Expliziter Hinweis, dass dieses Ticket **keine** IaC-/Produktionsänderungen auslöst und in einem späteren FinOps/Observability-Schritt umgesetzt wird.
- [ ] Referenz auf Roadmap/FinOps-Anforderungen (z. B. Roadmap 2.3.1 Schritte 8, 47) vorhanden.
