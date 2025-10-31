# Architektur (Referenz)
Modularer Monolith TS, Next.js PWA, Node API, Postgres, Redis, R2, EU-PaaS.
## EU-Datenstandorte, Secrets & Backups

### Ziel
Alle produktiven Daten, Secrets und Backups liegen in der EU. Keine US/AP/ME/SA/AU Regionen.

### Provider und erlaubte Regionen
- **Fly.io**: `ams`, `cdg`, `fra`, `lhr`, `arn`
- **Neon**: `aws-eu-central-1`, `aws-eu-west-2`, `azure-gwc`
- **Upstash Redis**: `eu-central-1`, `eu-west-1`, `eu-west-2`
- **Cloudflare R2**
  - `r2_location_hint`: `weur`, `eeur`
  - `r2_jurisdiction`: `eu`

### Technische Durchsetzung (Terraform)
- Variablen-Validation (Regex) verhindert Non-EU-Werte:
  - `fly_primary_region`, `neon_region`, `r2_location_hint`, `r2_jurisdiction`
- CI-Check blockt harte Non-EU-Strings (z. B. `us-`, `ap-`, `sa-`, `au-`):
  - Skript: `scripts/ci-terraform-eu.ps1`
  - zusätzlich: `terraform fmt -check` und `terraform validate`

### Secrets
- Secrets als **Terraform Vars** oder **CI-Secrets**. Keine Klartext-Commits.
- Benennung:
  - `fly_token`, `neon_api_key`, `upstash_api_key`, `cloudflare_api_token`
  - App-Konfiguration (nicht Provider-Secrets): `upstash_redis_url`, `upstash_redis_token`
- Herkunft prüfen:
  - **Upstash URL** muss `eu-*-*.upstash.io` enthalten.
  - **Neon/Cloud-Region** nur EU (siehe oben).

### Backups
- **Neon**: automatische Backups in der Projekt-Region. EU-Region wählen (`aws-eu-central-1` oder `aws-eu-west-2` bzw. `azure-gwc`).
- **R2**: `r2_jurisdiction="eu"` setzt rechtliche Jurisdiktion. `r2_location_hint` = `weur` oder `eeur` für Latenz/Standort.
- **Redis/Queues** (Upstash): Instanz in EU erstellen; Snapshots/Restores bleiben in derselben Region.

### Verifikation (Runbook)
1. **Static Code**  
   - `.\scripts\ci-terraform-eu.ps1` ausführen → darf keine Non-EU-Treffer melden.
   - `terraform validate` → darf keine Var-Validation-Fehler haben.
2. **Plan/State**  
   - `terraform plan -var-file="infra\terraform\env\dev.tfvars"`  
     Prüfen, dass alle Ressourcen EU-Regionen verwenden.
   - Nach Provisionierung: `terraform state show <resource>`  
     Felder `region|location|jurisdiction|url` auf EU prüfen.
3. **Provider-UIs**  
   - Fly: Primärregion = EU.  
   - Neon: Project Region = EU, Backups unter Project → Settings prüfen.  
   - Upstash: Database Region = EU, URL-Präfix `eu-`.  
   - Cloudflare R2: Bucket Policy → Jurisdiction = `eu`, Location Hint = `weur`/`eeur`.

### Incident & Drift
- Bei Abweichung: Deploy blockieren, Ticket erstellen, Region auf EU ändern, erneutes `plan`/`apply`.
- CI schlägt fehl, wenn `scripts/ci-terraform-eu.ps1` Non-EU findet.

### Nachweise (Audit)
- Artefakte: Terraform Plan, State-Auszug der Ressourcen, Screenshot der Provider-Einstellungen.
- Änderungsverlauf: PRs müssen ARCH-Abschnitt verlinken, wenn Regionen/Provider betroffen sind.
### Verifikation – Kurzcheck
- Lokal: `.\scripts\ci-terraform-eu.ps1 -Root .`, `terraform -chdir=infra/terraform validate`
- CI: GitHub Actions Workflow `terraform-ci`
- Bei Provisionierung:
  - `terraform plan -chdir=infra/terraform -var-file="env\dev.tfvars"`
  - Nach `apply`: `terraform state show <resource>` und auf `region|location|jurisdiction|url` prüfen


**Fehlerbilder (Beispiele)**
- EU-Scanner: `Non-EU match: <pfad> -> us-east-1`
- Terraform-Validation: Regex-Fehler bei `variable "<name>" { validation { ... } }`
- CI: Schritt `EU whitelist scan` oder `terraform validate` schlägt fehl → PR blockiert.
