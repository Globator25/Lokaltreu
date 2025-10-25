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
  source           = "../../modules/app"
  project          = var.project
  environment      = var.environment
  naming_prefix    = var.naming_prefix

  # Fly.io Deploy Region für die App
  region           = var.region_api

  fly_org_slug     = var.fly_org_slug
  fly_app_name     = var.fly_app_name

  # Sensibles Token kommt aus prod-Variablen / Secrets
  fly_access_token = var.fly_access_token

  # Tags nach prod erweitern
  tags             = merge(var.tags, { tier = "prod" })
}
