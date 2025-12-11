locals {
  component    = "mail-service"
  base_name    = "${var.project_name}-${var.env}"
  mail_profile = "${local.base_name}-mail"
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    purpose   = "transactional-mail"
    provider  = var.provider
  })
}

resource "mailjet_sender" "default" {
  count = var.sender_address == "" ? 0 : 1
  email = var.sender_address
  name  = var.sender_name != "" ? var.sender_name : local.mail_profile
}
