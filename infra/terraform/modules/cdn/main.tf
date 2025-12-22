locals {
  component     = "cdn"
  base_name     = "${var.project_name}-${var.env}"
  cdn_zone_name = "${local.base_name}-cdn"
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    purpose   = "pwa-delivery"
  })
}

resource "cloudflare_zone" "pwa" {
  count      = var.zone_name == "" ? 0 : 1
  account_id = var.cloudflare_account_id
  zone       = var.zone_name
  plan       = "free"
}

resource "cloudflare_zone_settings_override" "regional" {
  count  = length(cloudflare_zone.pwa) == 0 ? 0 : 1
  zone_id = cloudflare_zone.pwa[0].id

  settings {
    tls_1_3                  = "on"
    min_tls_version          = "1.2"
    http2                    = "on"
    automatic_https_rewrites = "on"
    brotli                   = "on"
    zero_rtt                 = "on"
    always_use_https         = "on"
    ssl                      = "strict"
    ipv6                     = "on"
    opportunistic_encryption = "on"
    websockets               = "on"
    cache_level              = "aggressive"
    polish                   = "lossless"
    regional_services        = var.enable_regional_services ? "on" : "off"
  }
}
