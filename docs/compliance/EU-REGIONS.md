# EU-REGIONS (Referenz)

**Fly.io**: ams, cdg, fra, lhr, arn  
**Neon**: aws-eu-central-1, aws-eu-west-2, azure-gwc  
**Upstash**: eu-central-1, eu-west-1, eu-west-2  
**Cloudflare R2**: location_hint = weur|eeur, jurisdiction = eu

Terraform-Beispiel (Cloudflare R2 nur EU):

```hcl
resource "cloudflare_r2_bucket" "main" {
  account_id   = var.cloudflare_account_id
  name         = var.r2_bucket_name
  jurisdiction = "eu"        # <- zwingend EU
}
```

> Hinweis: Diese Liste spiegelt die in `scripts/ci-terraform-eu.ps1` verwendeten Allowlists wider.
> Bei Provider-Änderungen hier und im Script gleichzeitig aktualisieren.
