locals {
  provider_slug = lower(var.mail_provider)
  service_id    = format("%s-%s-mail", var.project, var.environment)
}

resource "terraform_data" "descriptor" {
  input = {
    mail_service = local.service_id
    provider     = local.provider_slug
    region       = var.region
    tags         = var.tags
  }
}
