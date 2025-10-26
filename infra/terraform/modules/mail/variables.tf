variable "project" {
  type        = string
  description = "Project identifier used for mail routing naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to mail resources."
}

variable "mail_provider" {
  type        = string
  description = "Transactional mail provider slug."
}

variable "mail_api_key" {
  type        = string
  sensitive   = true
  default     = null
  nullable    = true
  description = "Optional API key for the provider."
}

variable "mail_service" {
  type        = string
  default     = null
  nullable    = true
  description = "Explicit service identifier; defaults to <project>-<environment>-mail when omitted."
}

variable "region" {
  type        = string
  default     = "eu"
  description = "Mail provider region (EU-only)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the mail descriptor."
}
