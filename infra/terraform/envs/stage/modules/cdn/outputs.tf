output "descriptor" {
  value = {
    zone_label = terraform_data.descriptor.output.zone_label
    cname      = terraform_data.descriptor.output.cname
    account_id = terraform_data.descriptor.output.account_id
    region     = terraform_data.descriptor.output.region
    tags       = terraform_data.descriptor.output.tags
  }
  description = "Cloudflare CDN descriptor constrained to EU POPs."
}
