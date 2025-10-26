output "descriptor" {
  value = {
    mail_service = var.mail_service
    provider     = var.mail_provider
    region       = var.region
    project      = var.project
    environment  = var.environment
    tags         = var.tags
  }
  description = "Transactional mail descriptor including service, provider, region, and project context."
}
