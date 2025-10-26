output "descriptor" {
  value = {
    bucket_name = terraform_data.descriptor.output.bucket_name
    endpoint    = terraform_data.descriptor.output.endpoint
    account_id  = terraform_data.descriptor.output.account_id
    region      = terraform_data.descriptor.output.region
    tags        = terraform_data.descriptor.output.tags
  }
  description = "Cloudflare R2 descriptor enforcing EU storage."
}
