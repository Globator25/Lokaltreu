locals {
  eu_allowed = {
    fly     = ["ams", "cdg", "fra", "lhr", "arn"]                # Fly.io Regions-Codes für EU
    neon    = ["aws-eu-central-1", "aws-eu-west-2", "azure-gwc"] # Neon EU-Deployments
    upstash = ["eu-central-1", "eu-west-1", "eu-west-2"]         # Upstash Redis EU
    r2_hint = ["weur", "eeur"]                                   # Cloudflare R2 location_hint
    r2_jur  = ["eu"]                                             # Cloudflare R2 jurisdiction
  }
}
