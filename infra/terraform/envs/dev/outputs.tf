output "naming_prefix" {
  value       = module.app.descriptor.app_name
  description = "Effective Fly.io app name derived for this environment."
}

output "fly_app" {
  value       = module.app.descriptor
  description = "Fly.io app descriptor including region, org, and tags."
}

output "postgres_branch" {
  value       = module.postgres.descriptor
  description = "Neon Postgres descriptor with branch and naming metadata."
}

output "redis_datastore" {
  value       = module.redis.descriptor
  description = "Upstash Redis descriptor with datastore naming and region."
}

output "r2_storage" {
  value       = module.storage.descriptor
  description = "Cloudflare R2 descriptor including bucket and endpoint info."
}

output "cdn_profile" {
  value       = module.cdn.descriptor
  description = "Cloudflare CDN descriptor including zone label and account."
}

output "mail_routing" {
  value       = module.mail.descriptor
  description = "Transactional mail descriptor for provider and naming context."
}
