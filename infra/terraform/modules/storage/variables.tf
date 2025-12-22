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
  description = "Cloudflare account ID required for R2 bucket management."
  default     = ""
}

variable "audit_bucket_name" {
  type        = string
  description = "Optional override for the audit bucket."
  default     = ""
}

variable "asset_bucket_name" {
  type        = string
  description = "Optional override for the asset bucket."
  default     = ""
}
