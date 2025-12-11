output "network_name" {
  description = "Deterministic network name derived from project and environment."
  value       = local.network_name
}

output "network_region" {
  description = "Region in which the network resources must be provisioned (EU-only)."
  value       = var.region
}

output "network_tags" {
  description = "Tag map to be reused when instantiating provider-specific network resources."
  value       = local.tags
}
