locals {
  bucket_name = format("%s-r2", var.naming_prefix)
  endpoint    = format("https://%s.r2.cloudflarestorage.com", var.cloudflare_account_id)
}

resource "terraform_data" "descriptor" {
  input = {
    bucket_name = local.bucket_name
    endpoint    = local.endpoint
    account_id  = var.cloudflare_account_id
    region      = var.region
    tags        = var.tags
  }
}
