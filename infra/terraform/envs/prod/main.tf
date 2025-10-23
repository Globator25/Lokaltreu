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

module "platform" {
  source = "../.."
  config = {
    project               = var.project
    environment           = var.environment
    naming_prefix         = var.naming_prefix
    region_api            = var.region_api
    region_postgres       = var.region_postgres
    region_redis          = var.region_redis
    region_storage        = var.region_storage
    region_cdn            = var.region_cdn
    fly_org_slug          = var.fly_org_slug
    fly_app_name          = var.fly_app_name
    fly_access_token      = var.fly_access_token
    neon_project_id       = var.neon_project_id
    neon_branch_name      = var.neon_branch_name
    neon_api_key          = var.neon_api_key
    upstash_team_id       = var.upstash_team_id
    upstash_email         = var.upstash_email
    upstash_api_key       = var.upstash_api_key
    cloudflare_account_id = var.cloudflare_account_id
    cloudflare_api_token  = var.cloudflare_api_token
    mail_provider         = var.mail_provider
    mail_api_key          = var.mail_api_key
    tags                  = merge(var.tags, { tier = "prod" })
  }
}
