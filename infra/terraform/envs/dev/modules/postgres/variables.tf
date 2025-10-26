variable "project" {
  type        = string
  description = "Project identifier used for naming database resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to database resources in this environment."
}

variable "region" {
  type        = string
  description = "Neon database region (e.g. aws-eu-central-1)."
}

variable "neon_project_id" {
  type        = string
  description = "Neon project identifier used for provisioning."
}

variable "neon_branch_name" {
  type        = string
  description = "Neon branch name associated with this environment."
}

variable "neon_api_key" {
  type        = string
  sensitive   = true
  description = "API key for authenticating with the Neon API."
}

variable "database_name" {
  type        = string
  description = "Logical database name to provision within the Neon project."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the database descriptor."
}
