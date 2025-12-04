# ADR 0002 – Secrets & SOPS Policy

## Policy
- Alle geheimen Artefakte (API-Keys, Datenbank-Passwörter, Terraform-Variablen, Device-Proof-Material) liegen ausschließlich in SOPS-verschlüsselten Dateien (`*.enc.*`), verwaltet via age/GPG-Schlüsselrotation.
- Klartext-Secrets sind im Repository, in Commit-Historien sowie in CI-/CD-Logs verboten; Checks schlagen fehl, sobald Klartext gefunden wird.
- CI/CD-Pipelines lesen Secrets nur über SOPS-Decryption zur Laufzeit und geben sie nie in stdout/stderr aus; sensitive Variablen werden maskiert.
- dev/stage/prod beziehen Secrets aus den providerseitigen Secret-Stores (z. B. Fly.io, Vercel, Terraform Cloud) und synchronisieren ausschließlich verschlüsselte Snapshots ins Repo.
- Terraform- und Deploy-Jobs brechen ab, wenn unverschlüsselte Secrets oder abweichende Regionen erkannt werden; Reviewer:innen verifizieren SOPS-Policies vor Merge.
