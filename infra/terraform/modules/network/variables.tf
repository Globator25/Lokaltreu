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
