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

provider "fly" {
  access_token = var.fly_token
}

provider "neon" {
  api_key = var.neon_api_key
}



provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
variable "upstash_email" {
  type      = string
  sensitive = true
}

