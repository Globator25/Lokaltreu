variable "project" {
  type        = string
  description = "Project identifier used for Fly.io naming."
}

variable "environment" {
  type        = string
  description = "Environment short code."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to Fly.io resources."
}

variable "region" {
  type        = string
  description = "Fly.io region (EU POP)."
}

variable "fly_org_slug" {
  type        = string
  description = "Fly.io organisation slug."
}

variable "fly_app_name" {
  type        = string
  default     = ""
  description = "Optional override for the Fly.io app name."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the Fly descriptor."
}

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "fly_org_slug" {
  type = string
}

variable "fly_access_token" {
  type      = string
  sensitive = true
}
