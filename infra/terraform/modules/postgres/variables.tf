variable "project" {
  type        = string
  description = "Project identifier used for database naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix inherited from the root module."
}

variable "region" {
  type        = string
  description = "Neon database region (EU only)."
}

variable "neon_project_id" {
  type        = string
  description = "Neon project identifier."
}

variable "neon_branch_name" {
  type        = string
  description = "Neon branch name for the environment."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the Neon descriptor."
}
