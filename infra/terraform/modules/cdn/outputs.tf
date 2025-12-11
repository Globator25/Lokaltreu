output "cdn_zone_name" {
  description = "Primary CDN zone name prepared for PWA/static delivery."
  value       = var.zone_name != "" ? var.zone_name : local.cdn_zone_name
}

output "cdn_region" {
  description = "EU region or colo preference for CDN components."
  value       = var.region
}

output "cdn_tags" {
  description = "Standardized tags for CDN resources."
  value       = local.tags
}

output "cdn_zone_id" {
  description = "Cloudflare zone ID when provisioned."
  value       = try(cloudflare_zone.pwa[0].id, null)
}
