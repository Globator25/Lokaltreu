resource "terraform_data" "descriptor" {
  input = {
    zone_label = var.zone_label
    cname      = var.cname
    account_id = var.cloudflare_account_id
    api_token  = var.cloudflare_api_token
    region     = var.region
    tags       = var.tags
  }
}
