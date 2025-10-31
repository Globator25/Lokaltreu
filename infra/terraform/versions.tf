terraform {
  required_version = ">= 1.6.0"

  required_providers {
    fly = {
      source  = "fly-apps/fly"
      version = "~> 0.0.23"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.9.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.11.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.1.0"
    }
  }
}
