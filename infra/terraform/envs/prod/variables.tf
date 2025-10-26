variable "project" {
  type    = string
  default = "lokaltreu"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "naming_prefix" {
  type    = string
  default = "lokaltreu-prod"
}

variable "region_api" {
  type    = string
  default = "fra"
}

variable "region_postgres" {
  type    = string
  default = "eu-central-1"
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

variable "fly_org_slug" {
  type    = string
  default = "lokaltreu"
}

variable "fly_app_name" {
  type    = string
  default = "lokaltreu-prod-app"
}

variable "fly_access_token" {
  type      = string
  sensitive = true
  default   = null
  nullable  = true
}

variable "neon_project_id" {
  type    = string
  default = "lokaltreu-prod"
}

variable "neon_branch_name" {
  type    = string
  default = "main"
}

variable "neon_api_key" {
  type      = string
  sensitive = true
  default   = null
  nullable  = true
}

variable "upstash_team_id" {
  type    = string
  default = "lokaltreu-prod"
}

variable "upstash_email" {
  type    = string
  default = "platform@lokaltreu.dev"
}

variable "upstash_api_key" {
  type      = string
  sensitive = true
  default   = null
  nullable  = true
}

variable "cloudflare_account_id" {
  type    = string
  default = "22222222222222222222222222222222"
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
  default   = null
  nullable  = true
}

variable "zone_label" {
  type    = string
  default = "lokaltreu-prod-cdn"
}

variable "cname" {
  type    = string
  default = "lokaltreu-prod.lokaltreu.dev"
}

variable "mail_provider" {
  type    = string
  default = "mailjet"
}

variable "mail_service" {
  type    = string
  default = "transactional-mail"
}

variable "mail_api_key" {
  type      = string
  sensitive = true
  default   = null
  nullable  = true
}

variable "tags" {
  type = map(string)
  default = {
    owner = "platform-team"
  }
}
