locals {
  zone_label = format("%s-%s", var.naming_prefix, "cdn")
  cname      = format("%s.lokaltreu.dev", var.naming_prefix)
}

resource "terraform_data" "descriptor" {
  input = {
    zone_label = local.zone_label
    cname      = local.cname
    account_id = var.cloudflare_account_id
    region     = var.region
    tags       = var.tags
  }
}
