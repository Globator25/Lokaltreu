variable "project" {
  type        = string
  description = "Project identifier used for naming Fly.io resources."
}

variable "environment" {
  type        = string
  description = "Environment short code (e.g. dev, stage, prod)."
}

variable "naming_prefix" {
  type        = string
  description = "Naming prefix applied to Fly.io resources in this environment."
}

variable "region" {
  type        = string
  description = "Fly.io region (e.g. fra, lhr, cdg)."
}

variable "fly_org_slug" {
  type        = string
  description = "Fly.io organisation slug used for app deployment."
}

variable "fly_app_name" {
  type        = string
  default     = ""
  description = "Optional override for the Fly.io app name. If empty, naming_prefix will be used."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags merged into the Fly.io app descriptor."
}
