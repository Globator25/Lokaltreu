output "descriptor" {
  value = {
    zone_label  = var.zone_label
    cname       = var.cname
    account_id  = var.cloudflare_account_id
    region      = var.region
    project     = var.project
    environment = var.environment
    tags        = var.tags
  }
  description = "Cloudflare CDN descriptor including zone, CNAME, account, region, and project context."
}
