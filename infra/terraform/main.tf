locals {
  active_env     = terraform.workspace == "default" ? var.env : terraform.workspace
  name_prefix    = "${var.project_name}-${local.active_env}"
  fly_region     = var.region_api
  neon_region    = var.region_api
  redis_region   = var.region_api
  storage_region = var.region_cdn
  cdn_region     = var.region_cdn
  mail_region    = var.region_cdn
  finops_tags = merge({
    project = var.project_name
    env     = local.active_env
  }, var.tags)
}

check "workspace_matches_env" {
  assert {
    condition     = terraform.workspace == "default" || terraform.workspace == var.env
    error_message = "Der gewählte Terraform-Workspace muss dem Wert von var.env entsprechen (dev/stage/prod)."
  }
}


module "network" {
  source = "./modules/network"

  env          = local.active_env
  project_name = var.project_name
  region       = local.fly_region
  tags         = local.finops_tags
}

module "app_runtime" {
  source = "./modules/app_runtime"

  env          = local.active_env
  project_name = var.project_name
  region       = local.fly_region
  tags         = local.finops_tags
}

module "db" {
  source = "./modules/db"

  env          = local.active_env
  project_name = var.project_name
  region       = local.neon_region
  tags         = local.finops_tags
}

module "redis" {
  source = "./modules/redis"

  env          = local.active_env
  project_name = var.project_name
  region       = local.redis_region
  tags         = local.finops_tags
}

module "storage" {
  source = "./modules/storage"

  env          = local.active_env
  project_name = var.project_name
  region       = local.storage_region
  tags         = local.finops_tags
}

module "mail" {
  source = "./modules/mail"

  env          = local.active_env
  project_name = var.project_name
  region       = local.mail_region
  tags         = local.finops_tags
}

module "cdn" {
  source = "./modules/cdn"

  env          = local.active_env
  project_name = var.project_name
  region       = local.cdn_region
  tags         = local.finops_tags
}
