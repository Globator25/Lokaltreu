# EU-Provider-Checklist (manuelle Verifikation)

Jeder Provider muss nachweisbar in EU-Rechenzentren betrieben werden. Nutze die folgende Checkliste bei Audits oder vor Provisionierung neuer Umgebungen.

## Fly.io / Render (App Hosting)
- [ ] **Region prüfen:** Im Fly.io-Dashboard → App auswählen → „Overview“ → `Primary Region`. Muss `eu-central` (oder dokumentierte EU-Region) sein.
- [ ] **Org/Apps:** Über „Organizations“ sicherstellen, dass alle dev/stage/prod-Apps der EU-Org zugeordnet sind. Bei Render: Dashboard → Service → „Region“ = Frankfurt (EU Central).
- [ ] **Deploy Hooks:** Falls Blue-Green oder Machines genutzt werden, prüfen ob `fly.toml` bzw. Service-Konfiguration keine US-Regionen referenziert.

## Neon (Postgres)
- [ ] **Projektregion:** Neon Console → Projekt → „Settings“ → „Region“. Muss `aws.eu-central-1`, `gcp.europe-west4` oder analog EU sein.
- [ ] **Branches:** Unter „Branches“ sicherstellen, dass neu angelegte Branches dasselbe EU-Projekt verwenden; keine Migration in andere Regionen.
- [ ] **Backups:** Abschnitt „Operations“ → „Backups“ zeigt Region. Verifizieren, dass Snapshot-Storage EU-Cluster ist.

## Upstash Redis
- [ ] **Instance Region:** Upstash Console → Redis → Instanz → „Region“. Muss `eu` (z. B. `eu-central-1` oder „Europe“) anzeigen.
- [ ] **Team/Projects:** Prüfen, ob neue Instanzen standardmäßig mit `Region = EU` erstellt werden (Defaults im UI).
- [ ] **API Keys:** Sicherstellen, dass API Keys nur für EU-Instanzen verwendet werden (Console → API Keys → zugewiesene DBs prüfen).

## Cloudflare R2 & CDN
- [ ] **R2 Buckets:** Cloudflare Dashboard → R2 → Bucket → „Jurisdiction“. Muss `EU` sein; bei Bedarf „Change jurisdiction“ prüfen.
- [ ] **Regional Services:** Cloudflare Dashboard → Websites → Zone → „Network“ → „Regional Services“ = aktiviert und auf „EU“ gesetzt.
- [ ] **TLS/Settings:** Unter „SSL/TLS“ sicherstellen, dass TLS ≥ 1.2 aktiv ist und kein Non-EU PoP konfiguriert wurde (z. B. Argo Smart Routing aus).

## Mailjet / Brevo (Mail)
- [ ] **Account-Einstellungen:** Mailjet Dashboard → Account → „General“ → „Data residency“ bzw. vertraglicher Hinweis: muss EU-Datenhaltung anzeigen. Bei Brevo: „My Plan“ → „Data location“ = EU.
- [ ] **Absender & Kontakte:** Prüfen, dass keinerlei Migration in Non-EU-Cluster aktiviert ist (z. B. Brevo Add-ons). Logs ≤ 30 Tage verbleiben in EU.
- [ ] **AVV/DPA Verweis:** In den Compliance-/Vertragsunterlagen bestätigen, dass die DPA explizit EU-Datenhaltung zusichert.

> Alle Schritte sollten dokumentiert (Screenshots/Notizen) und bei Abweichungen sofort an den Audit-Officer eskaliert werden.***
