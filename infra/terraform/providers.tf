terraform {
  required_providers {
    fly = {
      source  = "fly-io/fly"
      version = "~> 0.1"
    }
    neon = {
      source  = "neondatabase/neon"
      version = "~> 0.1"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    mailjet = {
      source  = "mailjet/mailjet"
      version = "~> 0.1"
    }
  }
}

locals {
  mail_secret = var.mail_api_secret != "" ? var.mail_api_secret : var.mail_api_key
}

provider "fly" {
  access_token = var.fly_token
  # Region enforcement erfolgt pro Modul über var.region_api (EU-only).
}

provider "neon" {
  api_key = var.neon_api_key
  region  = var.region_db
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
  region  = var.region_redis
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "mailjet" {
  api_key    = var.mail_api_key
  api_secret = local.mail_secret
  region     = "eu"
}
