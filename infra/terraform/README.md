# Lokaltreu – Terraform/IaC

## Environments & Workspaces
- Terraform-Workspaces = `dev`, `stage`, `prod`. Jeder Workspace besitzt:
  - eigenen Remote-State (Cloudflare R2 Bucket/Key in EU, siehe `backend.tf` + `env/*.backend.enc.tfvars`),
  - eigene Variablen (`env/<workspace>.tfvars`) und Secrets (`secrets/<workspace>.secrets.enc.tfvars`, via SOPS).
- Workflow:
  1. `terraform workspace select dev` (bzw. `new` beim ersten Mal),
  2. `terraform init -backend-config=/tmp/backend.dev.tfvars`,
  3. `terraform plan/apply -var-file=env/dev.tfvars -var-file=/tmp/dev.secrets.tfvars`.
- Stage/Prod folgen dem gleichen Muster; niemals Workspaces mischen oder Variablen tauschen.

## EU-Betrieb & Provider-Matrix
- Alle Ressourcen werden in EU-Regionen provisioniert; Terraform-Module erzwingen `eu-*` oder Provider-spezifische EU-Regionen (vgl. `providers.tf`, `main.tf`).
- Provider (Details siehe [docs/infra/providers-eu.md](../../docs/infra/providers-eu.md)):
  - **Fly.io** (`eu-central` Multi-AZ): App-Hosting (API, Worker, Status-Page).
  - **Neon PostgreSQL** (EU Cluster Frankfurt/Amsterdam): Multi-Tenant-Datenbank, Audit/WORM-Tabellen.
  - **Upstash Redis** (EU): Anti-Replay `SETNX`, Idempotency-Locks, Rate-Limits.
  - **Cloudflare R2 & Regional Services** (EU Jurisdiction): Object Storage (Backups, Audit-Exports, Terraform State) + CDN/DNS.
  - **Mailjet (Fallback: Brevo)** (EU): Security Alerts, Plan-Warnungen, Admin-Einladungen.
- Terraform-Workspaces erzeugen identische Ressourcen pro Environment; Provider-Konten/Projects sind dennoch logisch getrennt (z. B. separate Fly.io Org pro Stage/Prod).

## Sicherheitsprinzipien
- Keine Secrets im Klartext im Repo (SOPS-verschlüsselt).
- WORM-Audit-Log, 180 Tage Aufbewahrung (Implementierung folgt in späteren Schritten).
- Rate-Limits pro Tenant/IP/Card-ID/Device.

## Betriebsziele (SLO/Resilienz)
- Verfügbarkeit Kern-Routen: **99,90 %**.
- Latenz: **p50 ≤ 500 ms**, **p95 ≤ 3000 ms**, **p99 ≤ 6000 ms**.
- Resilienz: **RPO 15 min**, **RTO 60 min**.

## Lokale Nutzung (ohne Backend)
```ps1
# Backend lokal deaktivieren (bereits erfolgt)
terraform init -backend=false
$env:SOPS_AGE_KEY_FILE = "$HOME\.config\age\key.txt"
# Beispiel: dev
sops --decrypt secrets/dev.secrets.enc.tfvars > $env:TEMP\dev.secrets.tfvars
terraform plan -var-file="env/dev.tfvars" -var-file="$env:TEMP\dev.secrets.tfvars"
```

## SOPS / age-Setup
1. **Age-Schlüsselpaar erzeugen**  
   ```bash
   mkdir -p infra/terraform/.keys
   age-keygen -o infra/terraform/.keys/lokaltreu.agekey
   ```
   Die öffentliche Zeile (`age1…`) wandert in `.sops.yaml`, der private Key in den Secret-Store (z. B. `~/.config/age/key.txt`).  
2. **SOPS nutzen**  
   ```bash
   export SOPS_AGE_KEY_FILE=$HOME/.config/age/key.txt
   sops --encrypt --in-place infra/terraform/env/dev.backend.enc.tfvars
   sops --encrypt --in-place infra/terraform/secrets/dev.secrets.enc.tfvars
   ```
   Die Dateien im Repo enthalten nur Platzhalter, damit klar ist, welche Felder benötigt werden. Vor dem ersten Einsatz unbedingt mit echten Secrets überschreiben und neu verschlüsseln.  
3. **Decrypt für lokale Plans**  
   ```bash
   sops --decrypt infra/terraform/env/dev.backend.enc.tfvars > /tmp/backend.tfvars
   sops --decrypt infra/terraform/secrets/dev.secrets.enc.tfvars > /tmp/secrets.tfvars
   terraform plan -var-file=env/dev.tfvars -var-file=/tmp/secrets.tfvars
   ```

### Beispiel-Plaintext (vor der Verschlüsselung)
`env/dev.backend.tfvars`:
```hcl
bucket            = "lokaltreu-dev-terraform-state"
key               = "state/dev/terraform.tfstate"
region            = "eu-central-1"
endpoint          = "https://<r2-account>.r2.cloudflarestorage.com"
access_key_id     = "<STATE_ACCESS_KEY_ID>"
secret_access_key = "<STATE_SECRET_KEY>"
session_token     = "<TEMP_SESSION_TOKEN>"
```

`secrets/dev.secrets.tfvars`:
```hcl
fly_token            = "<FLY_API_TOKEN>"
neon_api_key         = "<NEON_API_KEY>"
upstash_api_key      = "<UPSTASH_API_KEY>"
upstash_email        = "dev@example.com"
cloudflare_api_token = "<CLOUDFLARE_API_TOKEN>"
mail_provider        = "mailjet"
mail_api_key         = "<MAILJET_API_KEY>"
mail_from_name       = "Lokaltreu Dev"
mail_from_address    = "alerts+dev@lokaltreu.example"
firebase_admin_salt  = "<RANDOM_SALT>"
```

## Guardrails gegen Klartext-tfvars
- `.gitignore` blockiert jede Datei `infra/terraform/**/*.tfvars`, außer sie endet auf `.enc.tfvars`.
- Script `npm run terraform:sops-check` (siehe `scripts/check-tfvars-encryption.mjs`) schlägt fehl, sobald ein Klartext-`tfvars` getrackt wird. In CI einfach vor `terraform fmt/validate` ausführen.
- Optional lokal über Husky: `npx husky add .husky/pre-commit "npm run terraform:sops-check"`.

## Format & Validate (lokal / CI)
```powershell
Set-Location infra/terraform
terraform fmt -recursive
terraform validate
```
Diese Befehle laufen automatisiert ebenfalls als CI-Gate (GitHub Actions) und müssen vor jedem Merge erfolgreich sein.

## Dev-Umgebung provisionieren (Provider in EU)
1. **Workspace vorbereiten**
   ```powershell
   Set-Location infra/terraform
   terraform workspace new dev   # einmalig
   terraform workspace select dev
   ```
2. **verschlüsselte Variablen entschlüsseln**
   ```powershell
   $env:SOPS_AGE_KEY_FILE = "$HOME\.config\age\key.txt"
   sops --decrypt envs/dev.tfvars.enc > envs/dev.tfvars
   ```
   > Hinweis: Die Datei `envs/dev.tfvars` nicht einchecken – nach Verwendung löschen.
3. **Plan & Apply (EU-only Provider)**
   ```powershell
   terraform plan  -var-file="envs/dev.tfvars"
   terraform apply -var-file="envs/dev.tfvars"
   ```
   Alle Module erzeugen Ressourcen ausschließlich in EU-Regionen: Fly/Render (`eu-central`), Neon (EU-Cluster), Upstash (EU), Cloudflare R2/CDN (EU Jurisdiction/Regional Services), Mailjet/Brevo (EU-Datenhaltung). Achte darauf, dass die Werte in `envs/dev.tfvars.enc` entsprechend gesetzt sind.

## CI (dev-Validierung)
- GitHub Actions Workflow „IaC Validate (dev)“ führt `fmt`, `validate`, `plan` aus.
- Secret: `AGE_PRIVATE_KEY` = Inhalt von `~/.config/age/key.txt`.

## Remote-State (CI)
- Backend-Dateien: `backend.dev|stage|prod.hcl`.
- Parameter: `endpoints.s3`, `use_path_style=true`, `skip_requesting_account_id=true`.
- Init in CI mit echten R2-Keys; **nicht lokal**.

## Ordnerstruktur
- `versions.tf`, `providers.tf`, `variables.tf`, `main.tf`, `outputs.tf`
- `env/{dev,stage,prod}.tfvars`
- `secrets/{dev,stage,prod}.secrets.enc.tfvars`
- `.sops.yaml`, ggf. `backend.tf.disabled` lokal
