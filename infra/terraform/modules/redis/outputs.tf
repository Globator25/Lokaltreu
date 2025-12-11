output "redis_name" {
  description = "Managed Redis instance name for anti-replay and caching workloads."
  value       = local.redis_name
}

output "redis_region" {
  description = "EU region hosting the Redis instance."
  value       = var.region
}

output "redis_tags" {
  description = "Standardized tags for Redis/cache resources."
  value       = local.tags
}

output "redis_rest_url" {
  description = "REST endpoint for Upstash Redis."
  value       = try(upstash_redis_database.primary.rest_url, null)
}

output "redis_console_url" {
  description = "Upstash console URL for the Redis instance."
  value       = try(upstash_redis_database.primary.console_url, null)
}
