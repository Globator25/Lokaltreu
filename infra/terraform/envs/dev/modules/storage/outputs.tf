output "descriptor" {
  value = {
    bucket_name = var.bucket_name
    endpoint    = var.endpoint
    account_id  = var.cloudflare_account_id
    region      = var.region
    project     = var.project
    environment = var.environment
    tags        = var.tags
  }
  description = "Cloudflare R2 descriptor including bucket, endpoint, region, and project context."
}
