# Lokaltreu – Terraform/IaC

## Environments
- **dev**, **stage**, **prod** strikt getrennt (eigener State, eigene Variablen).
- Variablen: `env/dev|stage|prod.tfvars`, Secrets: `secrets/*.secrets.enc.tfvars` (SOPS/age).

## EU-Betrieb
- Verarbeitung ausschließlich in der EU.
- CDN: Cloudflare **Regional Services (EU)**.
- Storage/State: S3-kompatibles Backend in EU (z. B. R2). Remote-State wird in CI initialisiert.

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
