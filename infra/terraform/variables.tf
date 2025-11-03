variable "name_prefix" {
  type    = string
  default = "lokaltreu-dev"
}

variable "neon_api_key" {
  type      = string
  sensitive = true
}

variable "upstash_api_key" {
  type      = string
  sensitive = true
}

variable "upstash_email" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

# EU-Policy Variablen
variable "neon_region" {
  type    = string
  default = "aws-eu-central-1" # Frankfurt (EU-27)
}

variable "upstash_region" {
  type    = string
  default = "eu-central-1" # Frankfurt (EU-27)
}

variable "r2_jurisdiction" {
  type    = string
  default = "eu"
}
