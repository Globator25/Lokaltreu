terraform {
  required_version = ">= 1.6.0"
}

locals {
  environment  = "dev"
  base_app_name = "lokaltreu-api-dev"
  base_db_name  = "lokaltreu_dev"
  default_tags = {
    project = var.project_name
    env     = local.environment
  }
}

variable "project_name" {
  type        = string
  description = "Globale Projektkennung für dev."
  default     = "lokaltreu"
}

variable "cost_center" {
  type        = string
  description = "FinOps-/Kostenstelle für diese Umgebung."
  default     = "lokaltreu-dev"
}

variable "fly_org_slug" {
  type        = string
  description = "Fly.io Org (leer lassen, falls noch nicht angelegt)."
  default     = ""
}

variable "region_app" {
  type        = string
  description = "EU-Region für App-Hosting (Fly/Render)."
  default     = "eu-central"
}

variable "region_db" {
  type        = string
  description = "EU-Region für Neon/Postgres."
  default     = "eu-central"
}

variable "region_redis" {
  type        = string
  description = "EU-Region für Upstash Redis."
  default     = "eu"
}

variable "region_storage" {
  type        = string
  description = "EU-Jurisdiction für Cloudflare R2."
  default     = "eu-central"
}

variable "region_cdn" {
  type        = string
  description = "EU-Region/Scope für Cloudflare CDN."
  default     = "eu"
}

variable "region_mail" {
  type        = string
  description = "EU-Region für den Mail-Provider."
  default     = "eu"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID (leer lassen für No-Op)."
  default     = ""
}

variable "cdn_zone_name" {
  type        = string
  description = "Basisdomain für dev (z. B. dev.lokaltreu.example)."
  default     = ""
}

variable "enable_regional_services" {
  type        = bool
  description = "Regional Services für Cloudflare CDN aktivieren."
  default     = true
}

variable "redis_plan" {
  type        = string
  description = "Upstash Plan (default serverless/free)."
  default     = "serverless"
}

variable "upstash_team_id" {
  type        = string
  description = "Optionaler Team-Slug für Upstash."
  default     = ""
}

variable "audit_bucket_override" {
  type        = string
  description = "Optionaler Audit-Bucket-Name."
  default     = ""
}

variable "asset_bucket_override" {
  type        = string
  description = "Optionaler Asset-Bucket-Name."
  default     = ""
}

variable "mail_provider" {
  type        = string
  description = "mailjet oder brevo."
  default     = "mailjet"
}

variable "mail_sender_name" {
  type        = string
  description = "Default Absendername."
  default     = "Lokaltreu Dev"
}

variable "mail_sender_address" {
  type        = string
  description = "Default Absenderadresse."
  default     = "alerts+dev@example.invalid"
}

# --- Module Instanzen ---

module "app_runtime" {
  source = "../../modules/app_runtime"

  env          = local.environment
  project_name = var.project_name
  region       = var.region_app
  app_name     = local.base_app_name
  fly_org_slug = var.fly_org_slug
  cost_center  = var.cost_center
  tags         = local.default_tags
}

module "db" {
  source = "../../modules/db"

  env          = local.environment
  project_name = var.project_name
  region       = var.region_db
  db_name      = local.base_db_name
  tags         = local.default_tags
}

module "redis" {
  source = "../../modules/redis"

  env          = local.environment
  project_name = var.project_name
  region       = var.region_redis
  plan         = var.redis_plan
  team_id      = var.upstash_team_id
  tags         = local.default_tags
}

module "storage" {
  source = "../../modules/storage"

  env                    = local.environment
  project_name           = var.project_name
  region                 = var.region_storage
  cloudflare_account_id  = var.cloudflare_account_id
  audit_bucket_name      = var.audit_bucket_override
  asset_bucket_name      = var.asset_bucket_override
  tags                   = local.default_tags
}

module "cdn" {
  source = "../../modules/cdn"

  env                       = local.environment
  project_name              = var.project_name
  region                    = var.region_cdn
  cloudflare_account_id     = var.cloudflare_account_id
  zone_name                 = var.cdn_zone_name
  enable_regional_services  = var.enable_regional_services
  tags                      = local.default_tags
}

module "mail" {
  source = "../../modules/mail"

  env            = local.environment
  project_name   = var.project_name
  region         = var.region_mail
  provider       = var.mail_provider
  sender_name    = var.mail_sender_name
  sender_address = var.mail_sender_address
  tags           = local.default_tags
}

# Beispiel-Schema für `envs/dev.tfvars.enc` (vor Verschlüsselung):
#
# project_name           = "lokaltreu"
# fly_org_slug           = "lokaltreu-dev"
# cost_center            = "lokaltreu-dev"
# region_app             = "eu-central"
# region_db              = "eu-central"
# region_redis           = "eu"
# region_storage         = "eu-central"
# region_cdn             = "eu"
# region_mail            = "eu"
# cloudflare_account_id  = "xxxxxx"
# cdn_zone_name          = "dev.lokaltreu.example"
# enable_regional_services = true
# redis_plan             = "serverless"
# upstash_team_id        = ""
# audit_bucket_override  = "lokaltreu-dev-audit"
# asset_bucket_override  = "lokaltreu-dev-assets"
# mail_provider          = "mailjet"
# mail_sender_name       = "Lokaltreu Dev"
# mail_sender_address    = "alerts+dev@lokaltreu.example"
