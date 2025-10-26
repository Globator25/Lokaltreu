output "descriptor" {
  value = {
    app_name   = local.computed_app_name
    org_slug   = var.fly_org_slug
    region     = var.region
    service_id = local.service_slug
    tags       = var.tags
  }
  description = "Fly App descriptor including naming, region, and tags."
}

output "naming_prefix" {
  value       = var.naming_prefix
  description = "Prefix used for naming resources in this environment."
}

output "fly_app" {
  value       = local.computed_app_name
  description = "Computed Fly App name based on prefix or override."
}
