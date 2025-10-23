output "descriptor" {
  value = {
    app_name     = terraform_data.descriptor.output.app_name
    org_slug     = terraform_data.descriptor.output.org_slug
    region       = terraform_data.descriptor.output.region
    service_slug = terraform_data.descriptor.output.service_slug
    tags         = terraform_data.descriptor.output.tags
  }
  description = "Fly.io application descriptor for EU-only deployment."
}
