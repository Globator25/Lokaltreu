# Architektur-Notizen: EU-Regionen & Compliance

- **Fly.io (var.fly_primary_region)**: `ams`, `cdg`, `fra`, `lhr`, `arn`
- **Neon (var.neon_region)**: `aws-eu-central-1`, `aws-eu-west-2`, `azure-gwc`
- **Upstash Redis (var.upstash_redis_url/_token)**: nur EU-Deployments (eu-central-1, eu-west-1, eu-west-2)
- **Cloudflare R2**
  - `r2_location_hint`: `weur`, `eeur`
  - `r2_jurisdiction`: `eu`

Diese Regeln sind in `variables.tf` per `validation {}` verankert und in `eu_regions.tf` dokumentiert.
CI führt `terraform fmt -check` und `terraform validate` aus; Verstöße gegen die Whitelist schlagen rot an.
