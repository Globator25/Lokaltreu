output "naming_prefix" {
  value = module.app.descriptor.app_name
}

output "fly_app" {
  value = module.app.descriptor
}

output "postgres_branch" {
  value = module.postgres.descriptor
}

output "redis_datastore" {
  value = module.redis.descriptor
}

output "r2_storage" {
  value = module.storage.descriptor
}

output "cdn_profile" {
  value = module.cdn.descriptor
}

output "mail_routing" {
  value = module.mail.descriptor
}
