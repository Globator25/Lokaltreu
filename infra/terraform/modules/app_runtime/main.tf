locals {
  component          = "app-runtime"
  base_name          = "${var.project_name}-${var.env}"
  service_name       = "${local.base_name}-app"
  release_identifier = "${local.service_name}-monolith"
  app_identifier     = trimspace(var.app_name) != "" ? var.app_name : local.service_name
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    workload  = "modular-monolith"
    service   = local.component
    cost_center = var.cost_center
  })
}

resource "fly_app" "monolith" {
  count          = var.fly_org_slug == "" ? 0 : 1
  name           = local.app_identifier
  org_slug       = var.fly_org_slug == "" ? null : var.fly_org_slug
  primary_region = var.region

  # Fly.io currently has limited tagging support; store FinOps/Env info as labels.
  labels = {
    environment = var.env
    service     = local.component
    cost_center = var.cost_center
  }
}
