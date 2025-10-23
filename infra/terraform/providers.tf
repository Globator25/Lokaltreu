provider "fly" {
  access_token = coalesce(try(var.config.fly_access_token, null), "")
}

provider "neon" {
  api_key = coalesce(try(var.config.neon_api_key, null), "")
}

provider "upstash" {
  api_key = coalesce(try(var.config.upstash_api_key, null), "")
  email   = coalesce(try(var.config.upstash_email, null), "")
}

provider "cloudflare" {
  api_token = coalesce(try(var.config.cloudflare_api_token, null), "")
}
