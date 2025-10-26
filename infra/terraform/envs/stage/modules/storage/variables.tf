variable "project" {
  type        = string
  description = "Project identifier used for R2 naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to R2 resources."
}

variable "region" {
  type        = string
  description = "Cloudflare R2 region (EU endpoint)."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account id hosting the R2 bucket."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the R2 descriptor."
}
