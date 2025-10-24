terraform {
  required_version = "~> 1.6.6"
}

locals {
  cfg           = var.config
  naming_prefix = coalesce(try(local.cfg.naming_prefix, null), format("%s-%s", local.cfg.project, local.cfg.environment))
  optional_tags = try(local.cfg.tags != null ? local.cfg.tags : {}, {})
  default_tags = {
    project = local.cfg.project
    env     = local.cfg.environment
  }
  cdn_zone_label = coalesce(try(local.cfg.zone_label, null), format("%s-%s", local.naming_prefix, "cdn"))
  cdn_cname      = coalesce(try(local.cfg.cname, null), format("%s.lokaltreu.dev", local.naming_prefix))
  tags           = merge(local.default_tags, local.optional_tags)
}

module "app" {
  source        = "./modules/app"
  project       = local.cfg.project
  environment   = local.cfg.environment
  naming_prefix = local.naming_prefix
  region        = local.cfg.region_api
  fly_org_slug  = local.cfg.fly_org_slug
  fly_app_name  = coalesce(try(local.cfg.fly_app_name, null), "")
  tags          = local.tags
}

module "postgres" {
  source        = "./modules/postgres"
  project       = local.cfg.project
  environment   = local.cfg.environment
  naming_prefix = local.naming_prefix

  region           = local.cfg.region_postgres
  neon_project_id  = local.cfg.neon_project_id
  neon_branch_name = local.cfg.neon_branch_name
  tags             = local.tags
}

module "redis" {
  source        = "./modules/redis"
  project       = local.cfg.project
  environment   = local.cfg.environment
  naming_prefix = local.naming_prefix

  region          = local.cfg.region_redis
  upstash_team_id = local.cfg.upstash_team_id
  tags            = local.tags
}

module "storage" {
  source                = "./modules/storage"
  project               = local.cfg.project
  environment           = local.cfg.environment
  naming_prefix         = local.naming_prefix
  region                = local.cfg.region_storage
  cloudflare_account_id = local.cfg.cloudflare_account_id
  tags                  = local.tags
}

module "cdn" {
  source        = "./modules/cdn"
  project       = local.cfg.project
  environment   = local.cfg.environment
  naming_prefix = local.naming_prefix

  region                = local.cfg.region_cdn
  cloudflare_account_id = local.cfg.cloudflare_account_id
  cloudflare_api_token  = try(local.cfg.cloudflare_api_token, null)
  zone_label            = local.cdn_zone_label
  cname                 = local.cdn_cname
  tags                  = local.tags
}

module "mail" {
  source        = "./modules/mail"
  project       = local.cfg.project
  environment   = local.cfg.environment
  naming_prefix = local.naming_prefix

  mail_provider = local.cfg.mail_provider
  mail_service  = try(local.cfg.mail_service, null)
  mail_api_key  = try(local.cfg.mail_api_key, null)
  region        = "eu"
  tags          = local.tags
}

