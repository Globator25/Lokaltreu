output "storage_audit_bucket" {
  description = "R2 bucket name used for audit/WORM exports."
  value       = local.audit_bucket
}

output "storage_asset_bucket" {
  description = "R2 bucket name used for static assets/reporting dumps."
  value       = local.asset_bucket
}

output "storage_region" {
  description = "EU region / jurisdiction for the object storage account."
  value       = var.region
}

output "storage_tags" {
  description = "Standardized tags for Cloudflare R2 resources."
  value       = local.tags
}
