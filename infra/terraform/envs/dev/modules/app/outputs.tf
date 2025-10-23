output "fly_app" {
  value       = local.computed_app_name
  description = "Computed Fly.io app name based on naming_prefix or override."
}

output "naming_prefix" {
  value       = var.naming_prefix
  description = "Naming prefix used for Fly.io resources in this environment."
}

output "descriptor" {
  value = {
    app_name    = local.computed_app_name
    org_slug    = var.fly_org_slug
    region      = var.region
    project     = var.project
    environment = var.environment
    tags        = var.tags
  }
  description = "Fly.io app descriptor including naming, region, project context, and tags."
}
