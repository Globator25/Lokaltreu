output "app_runtime_service_name" {
  description = "Logical service name for the modular monolith runtime."
  value       = local.app_identifier
}

output "app_runtime_release_identifier" {
  description = "Identifier that can be mapped to Blue-Green or Canary deployments."
  value       = local.release_identifier
}

output "app_runtime_tags" {
  description = "Tag map for runtime resources (PaaS app, workers, scaling groups)."
  value       = local.tags
}

output "app_runtime_id" {
  description = "Fly.io app ID (null until provisioned)."
  value       = try(fly_app.monolith[0].id, null)
}
