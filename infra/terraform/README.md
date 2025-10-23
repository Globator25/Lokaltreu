# IaC – Terraform/SOPS

## Struktur & Guardrails
- `envs/{dev,stage,prod}` – Root-Module pro Umgebung inkl. `backend.hcl`.
- `modules/*` – Komponenten-Stubs (App, Postgres, Redis, Storage, CDN, Mail) mit EU-Vorgaben.
- `envs/*/*.secrets.enc.tfvars` – Durch SOPS (age) verschlüsselte Werte, kein Klartext im Repo.
- `.sops.yaml` – Erzwingt age-Empfänger pro Umgebung, `*_unencrypted` als bewusste Ausnahmen.

## Betrieb in EU

| Dienst            | Region-Default        | Hinweis                                                       |
|-------------------|-----------------------|---------------------------------------------------------------|
| Fly.io App        | `fra`                 | PaaS Region ams/cdg/fra/mad/otp, außerhalb EU blockiert       |
| Neon Postgres     | `eu-central-1`        | Branch je Umgebung (`dev`, `staging`, `main`)                 |
| Upstash Redis     | `eu-central-1`        | Team-ID je Umgebung, EU-only                                  |
| Cloudflare R2     | `eu-central-1` + R2   | S3-kompatibel, Regional Services aktiv                        |
| Cloudflare CDN    | `eu` (Regional)       | Global CDN gesperrt, nur EU POPs                              |
| Mailjet/Brevo     | `mailjet` (EU tenancy)| DSGVO-konforme Anbieter                                       |

> **Hinweis:** Für `lokaltreu-terraform-state` in R2 sind **SSE (AES256)** und **Versioning** zu aktivieren, damit RPO/RTO-Ziele eingehalten werden.

| Kennzahl | Ziel            | Nachweis                                      |
|----------|-----------------|-----------------------------------------------|
| SLO      | 99,90 %         | Fly.io + synthetic probes                     |
| RPO      | 15 min          | Neon PITR + Redis snapshots                   |
| RTO      | 60 min          | Automatisiertes Terraform Plan/Apply + Runbooks |

## Onboarding & Ablauf
1. `age-keygen -o age-<env>.key` ausführen, Public-Key in `.sops.yaml` einsetzen, privaten Key als **GitHub Secret** `SOPS_AGE_KEY` hinterlegen (Klartext, inkl. `-----BEGIN AGE PRIVATE KEY-----` Block).
2. Secrets befüllen: `sops infra/terraform/envs/dev/dev.secrets.enc.tfvars` (verschlüsselte tfvars per Umgebung).
3. Remote-State initialisieren:
   ```bash
   terraform -chdir=infra/terraform/envs/dev init -backend-config=backend.hcl
   ```
4. Validierung & Plan:
   ```bash
   terraform -chdir=infra/terraform/envs/dev fmt -recursive -check
   terraform -chdir=infra/terraform/envs/dev validate
   ```
5. Plan mit Secrets (Beispiel dev):
   ```bash
   sops -d infra/terraform/envs/dev/dev.secrets.enc.tfvars > $TMP/dev.tfvars
   terraform -chdir=infra/terraform/envs/dev plan -var-file=$TMP/dev.tfvars -out=dev.plan
   ```

## Runbooks kurz
- **State-Lock lösen:** `terraform force-unlock <lock-id>` nach Prüfung der ausstehenden Änderungen.
- **Key-Rotation:** neuen age-Key erzeugen, `.sops.yaml` aktualisieren, `sops updatekeys -y envs/*/*.secrets.enc.tfvars`.
- **Incident (RPO/RTO):** Restore Neon Branch (PITR), Redis Snapshot importieren, Fly.io Deployment neu starten, CDN Cache purgen.
- **Audit:** Plan-/Validate-Logs unter `artifacts/` ablegen (`tee -a` laut AGENTS.md Abschnitt 10).
- **R2 Hardening:** Einmalig Versionierung + SSE aktivieren:
  1. `aws s3api put-bucket-versioning --bucket lokaltreu-terraform-state --versioning-configuration Status=Enabled --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
  2. `aws s3api put-bucket-encryption --bucket lokaltreu-terraform-state --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

## Konsistenz-Checkliste
- `terraform fmt -recursive -check` grün.
- `terraform validate` je Umgebung, Remote-State EU-only.
- `terraform plan` (kein Apply im CI) als Artefakt.
- CI-Workflow `.github/workflows/iac-validate.yml` blockiert Nicht-EU-Regionen.
- AGENTS.md Gate erfüllt: **Terraform fmt + validate grün; EU-Region erzwungen** als Pflichtstatus im PR.
- Keine Klartext-Secrets; alle Änderungen nachvollziehbar via Git History.
- **Provider Lock:** `terraform providers lock -platform=linux_amd64 -platform=windows_amd64` ausführen; das CI verifiziert, dass `infra/terraform/.terraform.lock.hcl` unverändert bleibt.

## PR Gate
1. GitHub → Settings → Branches → „main“ → Branch protection rule erstellen/bearbeiten.
2. **Require status checks to pass before merging** aktivieren und `IaC Validate` als Pflicht-Check hinzufügen.
3. Optional via CLI (GitHub CLI muss authentifiziert sein):
   ```bash
   gh auth login --hostname github.com --git-protocol https
   gh api -X PUT repos/:owner/:repo/branches/main/protection --input .github/branch-protection.json
   ```
4. Secret `SOPS_AGE_KEY` enthält den privaten age-Key (inkl. `-----BEGIN AGE PRIVATE KEY-----` Block); die CI nutzt ihn direkt zur Entschlüsselung – keine Key-Dateien im Repo.
- **Required Context:** Der Branch-Protection-Check muss exakt dem Workflow-Namen entsprechen (`IaC Validate`).

### PR Gate – Required Status
- Ausführen im Repo-Root (Windows PowerShell):
  ```powershell
  gh auth login --hostname github.com --git-protocol https
  gh api -X PUT repos/:owner/:repo/branches/main/protection --input .github/branch-protection.json
  ```

## R2 Verify
- **Hinweis:** R2 nutzt ein account-spezifisches Endpoint-Hostformat `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` und erfordert `use_path_style=true`.
- Versionierung überprüfen:
  ```bash
  aws s3api get-bucket-versioning \
    --bucket lokaltreu-terraform-state \
    --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  # Erwartete Antwort: {"Status":"Enabled"}
  ```
- Server-Side-Encryption prüfen:
  ```bash
  aws s3api get-bucket-encryption \
    --bucket lokaltreu-terraform-state \
    --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  # Erwartete Antwort:
  # {
  #   "ServerSideEncryptionConfiguration": {
  #     "Rules": [
  #       {
  #         "ApplyServerSideEncryptionByDefault": {
  #           "SSEAlgorithm": "AES256"
  #         }
  #       }
  #     ]
  #   }
  # }
  # Minimal: {"ServerSideEncryptionConfiguration":{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}}
  ```
