locals {
  computed_app_name = length(trimspace(var.fly_app_name)) > 0 ? var.fly_app_name : format("%s-app", var.naming_prefix)
  service_slug      = format("%s-%s", var.project, var.environment)
}

resource "terraform_data" "descriptor" {
  input = {
    app_name     = local.computed_app_name
    org_slug     = var.fly_org_slug
    region       = var.region
    service_slug = local.service_slug
    tags         = var.tags
  }
}
