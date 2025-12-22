output "mail_profile" {
  description = "Transactional mail profile name (Mailjet/Brevo)."
  value       = local.mail_profile
}

output "mail_region" {
  description = "EU region / cluster for the transactional mail provider."
  value       = var.region
}

output "mail_tags" {
  description = "Standardized tags for transactional mail resources."
  value       = local.tags
}

output "mail_sender_verified" {
  description = "Indicates if the default sender has been configured."
  value       = length(mailjet_sender.default) > 0
}
