locals {
  component   = "storage-r2"
  base_name   = "${var.project_name}-${var.env}"
  audit_bucket = trimspace(var.audit_bucket_name) != "" ? var.audit_bucket_name : lower("${local.base_name}-audit")
  asset_bucket = trimspace(var.asset_bucket_name) != "" ? var.asset_bucket_name : lower("${local.base_name}-assets")
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    purpose   = "audit-and-assets"
  })
}

resource "cloudflare_r2_bucket" "audit" {
  count       = var.cloudflare_account_id == "" ? 0 : 1
  account_id  = var.cloudflare_account_id
  name        = local.audit_bucket
  location    = var.region
  jurisdiction = "eu"
}

resource "cloudflare_r2_bucket" "assets" {
  count       = var.cloudflare_account_id == "" ? 0 : 1
  account_id  = var.cloudflare_account_id
  name        = local.asset_bucket
  location    = var.region
  jurisdiction = "eu"
}
