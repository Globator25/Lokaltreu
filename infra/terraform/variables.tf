variable "project_name" {
  type        = string
  description = "Name/Slug des Projekts (Tags, Prefixes)."
  default     = "lokaltreu"
}

variable "env" {
  type        = string
  description = "Einsatzumgebung (Terraform Workspace: dev/stage/prod)."

  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "env muss dev, stage oder prod sein."
  }
}

variable "tags" {
  type        = map(string)
  description = "Zusätzliche optionale Tags (werden mit FinOps-Tags zusammengeführt)."
  default     = {}
}

variable "region_api" {
  type        = string
  description = "Region für API/Fly.io (muss mit EU beginnen)."
  default     = "eu-central"

  validation {
    condition     = can(regex("^eu", lower(var.region_api)))
    error_message = "region_api muss eine EU-Region sein (beginnt mit 'eu')."
  }
}

variable "region_db" {
  type        = string
  description = "Region für Neon/Postgres (EU-Cluster)."
  default     = "eu-central"

  validation {
    condition     = can(regex("^eu", lower(var.region_db)))
    error_message = "region_db muss eine EU-Region sein (beginnt mit 'eu')."
  }
}

variable "region_redis" {
  type        = string
  description = "Region für Upstash Redis (EU)."
  default     = "eu"

  validation {
    condition     = can(regex("^eu", lower(var.region_redis)))
    error_message = "region_redis muss eine EU-Region sein (beginnt mit 'eu')."
  }
}

variable "region_cdn" {
  type        = string
  description = "Region/Scope für Cloudflare Regional Services."
  default     = "eu"

  validation {
    condition     = can(regex("^eu", lower(var.region_cdn)))
    error_message = "region_cdn muss eine EU-Region sein (beginnt mit 'eu')."
  }
}

variable "r2_bucket" {
  type        = string
  description = "Cloudflare R2 Bucket-Name (EU Jurisdiction) für Audits/Assets."
}

variable "fly_token" {
  type        = string
  sensitive   = true
  description = "Fly.io Personal Access Token (nur EU-Org)."
}

variable "neon_api_key" {
  type        = string
  sensitive   = true
  description = "Neon API Key mit Zugriff auf das EU-Projekt."
}

variable "upstash_api_key" {
  type        = string
  sensitive   = true
  description = "Upstash API Key (EU-Region)."
}

variable "upstash_email" {
  type        = string
  description = "Upstash Account-E-Mail (EU-Region)."
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API Token mit Zugriff auf R2/CDN/DNS."
}

variable "mail_provider" {
  type        = string
  description = "Mail Provider (mailjet oder brevo)."

  validation {
    condition     = contains(["mailjet", "brevo"], var.mail_provider)
    error_message = "mail_provider muss 'mailjet' oder 'brevo' sein."
  }
}

variable "mail_api_key" {
  type        = string
  sensitive   = true
  description = "API-Key für den konfigurierten Mail-Provider."
}

variable "mail_api_secret" {
  type        = string
  sensitive   = true
  description = "Secret / password für den Mail-Provider (Mailjet benötigt Key+Secret, Brevo nutzt nur Key)."
  default     = ""
}

variable "mail_from_name" {
  type        = string
  description = "Default 'From Name' für transaktionale Mails."
}

variable "mail_from_address" {
  type        = string
  description = "Default 'From Address' (z. B. alerts@lokaltreu.example)."
}
