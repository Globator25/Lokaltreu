variable "project" {
  type        = string
  description = "Project identifier used for naming Cloudflare R2 resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to R2 resources in this environment."
}

variable "region" {
  type        = string
  description = "Cloudflare R2 region (e.g. auto, eu)."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID hosting the R2 bucket."
}

variable "bucket_name" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional override for the R2 bucket name; defaults to <naming_prefix>-r2."
}

variable "endpoint" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional override for the R2 endpoint URL; defaults to https://<account>.r2.cloudflarestorage.com."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the R2 bucket descriptor."
}
