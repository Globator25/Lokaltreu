########################################
# Allgemeine Projekt- und Umgebungseinstellungen
########################################

variable "project" {
  type    = string
  default = "lokaltreu"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "naming_prefix" {
  type    = string
  default = "lokaltreu-dev"
}

variable "tags" {
  type = map(string)
  default = {
    project = "lokaltreu"
    env     = "dev"
    owner   = "platform-team"
  }
}

########################################
# Regionen
########################################

variable "region_api" {
  type    = string
  default = "fra"
}

variable "region_postgres" {
  type    = string
  default = "eu-central"
}

variable "region_redis" {
  type    = string
  default = "eu-central-1"
}

variable "region_storage" {
  type    = string
  default = "eu-central-1"
}

variable "region_cdn" {
  type    = string
  default = "eu"
}

########################################
# Fly.io
########################################

variable "fly_org_slug" {
  type    = string
  default = "lokaltreu"
}

variable "fly_app_name" {
  type    = string
  default = "lokaltreu-dev-app"
}

variable "fly_access_token" {
  type        = string
  sensitive   = true
  nullable    = true
  description = "Access token for Fly.io API."
}

########################################
# Neon (Postgres)
########################################

variable "neon_project_id" {
  type    = string
  default = "lokaltreu-dev"
}

variable "neon_branch_name" {
  type    = string
  default = "dev"
}

variable "neon_api_key" {
  type        = string
  sensitive   = true
  nullable    = true
  description = "API key for Neon Postgres."
}

variable "database_name" {
  type        = string
  description = "Name of the Neon database."
}

########################################
# Upstash (Redis)
########################################

variable "upstash_team_id" {
  type    = string
  default = "lokaltreu-dev"
}

variable "upstash_email" {
  type    = string
  default = "platform@lokaltreu.dev"
}

variable "upstash_api_key" {
  type        = string
  sensitive   = true
  nullable    = true
  description = "API key for Upstash Redis."
}

variable "datastore_name" {
  type        = string
  description = "Name of the Redis datastore."
}

########################################
# Cloudflare (CDN / DNS)
########################################

variable "cloudflare_account_id" {
  type    = string
  default = "00000000000000000000000000000000"
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  nullable    = true
  description = "API token for Cloudflare DNS and CDN management."
}

variable "zone_label" {
  type        = string
  description = "Cloudflare zone label, e.g. 'lokaltreu.dev'."
}

variable "cname" {
  type        = string
  description = "CNAME record for the app, e.g. 'app.lokaltreu.dev'."
}

########################################
# Mail Provider (z. B. Mailjet)
########################################

variable "mail_provider" {
  type    = string
  default = "mailjet"
}

variable "mail_service" {
  type    = string
  default = "transactional-mail"
}

variable "mail_api_key" {
  type        = string
  sensitive   = true
  nullable    = true
  description = "API key for Mail provider."
}
