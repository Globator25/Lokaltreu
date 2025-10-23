output "naming_prefix" {
  value       = module.app.descriptor.app_name
  description = "Effective naming prefix applied to all infrastructure resources."
}

output "fly_app" {
  value       = module.app.descriptor
  description = "Fly.io application descriptor with EU region enforced."
}

output "postgres_branch" {
  value       = module.postgres.descriptor
  description = "Neon Postgres project and branch details."
}

output "redis_datastore" {
  value       = module.redis.descriptor
  description = "Upstash Redis datastore descriptor anchored in EU."
}

output "r2_storage" {
  value       = module.storage.descriptor
  description = "Cloudflare R2 storage bucket descriptor stored in EU jurisdiction."
}

output "cdn_profile" {
  value       = module.cdn.descriptor
  description = "Cloudflare CDN Regional Services descriptor."
}

output "mail_routing" {
  value       = module.mail.descriptor
  description = "Transactional mail provider descriptor guaranteed to stay within EU."
}

