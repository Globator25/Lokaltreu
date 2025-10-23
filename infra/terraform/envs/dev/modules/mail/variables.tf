variable "project" {
  type        = string
  description = "Project identifier used for naming mail resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to mail resources in this environment."
}

variable "mail_provider" {
  type        = string
  description = "Transactional mail provider slug (e.g. mailjet, sendgrid)."
}

variable "mail_api_key" {
  type        = string
  sensitive   = true
  description = "API key for authenticating with the mail provider."
}

variable "mail_service" {
  type        = string
  description = "Logical service name used for mail routing."
}

variable "region" {
  type        = string
  default     = "eu"
  description = "Mail provider region (e.g. eu, us)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the mail descriptor."
}
