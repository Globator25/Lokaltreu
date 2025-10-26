variable "project" {
  type        = string
  description = "Project identifier used for naming CDN resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to CDN resources in this environment."
}

variable "region" {
  type        = string
  description = "Cloudflare Regional Services region (e.g. eu)."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID hosting the CDN configuration."
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "API token for authenticating with Cloudflare."
}

variable "cname" {
  type        = string
  description = "CNAME record to associate with the CDN."
}

variable "zone_label" {
  type        = string
  description = "Label used to identify the CDN zone."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the CDN descriptor."
}
