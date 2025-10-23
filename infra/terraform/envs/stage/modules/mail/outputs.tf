output "descriptor" {
  value = {
    mail_service = terraform_data.descriptor.output.mail_service
    provider     = terraform_data.descriptor.output.provider
    region       = terraform_data.descriptor.output.region
    tags         = terraform_data.descriptor.output.tags
  }
  description = "Transactional mail descriptor compliant with EU residency."
}
