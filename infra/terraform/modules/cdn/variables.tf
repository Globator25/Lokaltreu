variable "env" {
  type        = string
  description = "Logical deployment environment, e.g. dev, stage or prod."
}

variable "region" {
  type        = string
  description = "EU region identifier enforced for Lokaltreu infrastructure."

  validation {
    condition     = can(regex("^eu", lower(var.region)))
    error_message = "Only EU regions are permitted for Lokaltreu infrastructure."
  }
}

variable "project_name" {
  type        = string
  description = "Project name prefix used to derive deterministic resource names."
}

variable "tags" {
  type        = map(string)
  description = "Common tags propagated to all resources created by the module."
  default     = {}
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID used for CDN/Zone configuration."
  default     = ""
}

variable "zone_name" {
  type        = string
  description = "Base domain/zone for CDN operations (e.g. lokaltreu.app)."
  default     = ""
}

variable "enable_regional_services" {
  type        = bool
  description = "Toggle Cloudflare Regional Services for EU-only routing."
  default     = true
}
