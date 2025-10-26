variable "project" {
  type        = string
  description = "Project identifier used for CDN naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to CDN resources."
}

variable "region" {
  type        = string
  description = "Cloudflare Regional Services scope (EU)."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account id hosting the CDN configuration."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the CDN descriptor."
}
