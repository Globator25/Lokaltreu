terraform {
  required_version = "~> 1.6.6"

  required_providers {
    fly = {
      source  = "fly-apps/fly"
      version = "0.0.23"
    }

    neon = {
      source  = "kislerdm/neon"
      version = "0.10.0"
    }

    upstash = {
      source  = "upstash/upstash"
      version = "2.1.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.11.0"
    }
  }
}

module "app" {
  source        = "./modules/app"
  project       = var.project
  environment   = var.environment
  naming_prefix = var.naming_prefix
  region        = var.region_api
  fly_org_slug  = var.fly_org_slug
  fly_app_name  = var.fly_app_name
  tags          = merge(var.tags, { tier = "dev" })
}

module "postgres" {
  source           = "./modules/postgres"
  project          = var.project
  environment      = var.environment
  naming_prefix    = var.naming_prefix
  region           = var.region_postgres
  neon_project_id  = var.neon_project_id
  neon_branch_name = var.neon_branch_name
  neon_api_key   = var.neon_api_key
  database_name  = var.database_name
  tags             = merge(var.tags, { tier = "dev" })
}

module "redis" {
  source          = "./modules/redis"
  project         = var.project
  environment     = var.environment
  naming_prefix   = var.naming_prefix
  region          = var.region_redis
  upstash_team_id = var.upstash_team_id
  datastore_name   = var.datastore_name
  upstash_email    = var.upstash_email
  upstash_api_key  = var.upstash_api_key
  tags            = merge(var.tags, { tier = "dev" })
}

module "cdn" {
  source                = "./modules/cdn"
  project               = var.project
  environment           = var.environment
  naming_prefix         = var.naming_prefix
  region                = var.region_cdn
  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_api_token  = var.cloudflare_api_token
  zone_label            = var.zone_label
  cname                 = var.cname
  tags                  = merge(var.tags, { tier = "dev" })
}

module "mail" {
  source        = "./modules/mail"
  project       = var.project
  environment   = var.environment
  naming_prefix = var.naming_prefix
  mail_provider = var.mail_provider
  mail_api_key  = var.mail_api_key
  mail_service  = var.mail_service
  tags          = merge(var.tags, { tier = "dev" })
}

module "storage" {
  source                = "./modules/storage"
  project               = var.project
  environment           = var.environment
  naming_prefix         = var.naming_prefix
  region                = var.region_storage
  cloudflare_account_id = var.cloudflare_account_id
  tags                  = merge(var.tags, { tier = "dev" })
}
