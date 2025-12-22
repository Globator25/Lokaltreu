output "database_name" {
  description = "Primary Postgres database identifier derived from project and environment."
  value       = local.database_name
}

output "database_region" {
  description = "EU region assigned to the Postgres deployment."
  value       = var.region
}

output "database_tags" {
  description = "Standardized tags for Postgres resources (instances, branches, read replicas)."
  value       = local.tags
}

output "database_connection_url" {
  description = "Managed connection URL (Neon) for the primary branch/database."
  value       = try(neon_database.primary.connection_uri, null)
}

output "database_host" {
  description = "Hostname for the read/write endpoint."
  value       = try(neon_endpoint.primary.host, null)
}

output "database_port" {
  description = "Port for the read/write endpoint."
  value       = try(neon_endpoint.primary.port, null)
}
