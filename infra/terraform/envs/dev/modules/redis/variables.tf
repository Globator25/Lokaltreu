variable "project" {
  type        = string
  description = "Project identifier used for naming Redis resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to Upstash Redis resources in this environment."
}

variable "region" {
  type        = string
  description = "Upstash region (e.g. eu, us)."
}

variable "upstash_team_id" {
  type        = string
  description = "Upstash team identifier used for provisioning."
}

variable "upstash_api_key" {
  type        = string
  sensitive   = true
  description = "API key for authenticating with Upstash."
}

variable "upstash_email" {
  type        = string
  description = "Email address associated with the Upstash account."
}

variable "datastore_name" {
  type        = string
  description = "Logical Redis datastore name for this environment."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the Redis descriptor."
}
