variable "project" {
  type        = string
  description = "Project identifier used for Redis naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to Upstash resources."
}

variable "region" {
  type        = string
  description = "Upstash region (EU only)."
}

variable "upstash_team_id" {
  type        = string
  description = "Upstash team identifier."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the Redis descriptor."
}
