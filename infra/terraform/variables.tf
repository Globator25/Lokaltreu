variable "env" { type = string }
variable "region_api" { type = string }
variable "region_cdn" { type = string }

variable "fly_token" {
  type      = string
  sensitive = true
}
variable "neon_api_key" {
  type      = string
  sensitive = true
}
variable "upstash_api_key" {
  type      = string
  sensitive = true
}
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}
variable "upstash_email" {
  type      = string
  sensitive = true
}
