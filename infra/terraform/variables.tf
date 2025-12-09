variable "env" {
  type = string
}
variable "region_api" {
  type = string
}
variable "region_cdn" {
  type = string
}
variable "r2_bucket" {
  type = string
}
# Nur deklarieren, wenn NICHT bereits in providers.tf vorhanden:
# variable "mail_provider" { type = string }
# variable "mail_api_key"  { type = string  sensitive = true }
variable "mail_provider" {
  type = string
  validation {
    condition     = contains(["mailjet", "brevo"], var.mail_provider)
    error_message = "mail_provider muss 'mailjet' oder 'brevo' sein."
  }
}
variable "mail_api_key" {
  type      = string
  sensitive = true
}
# optionale Dev-Defaults (nur wenn ihr das wollt)
# variable "env"        { type = string default = "dev" }
# variable "region_api" { type = string default = "eu-central" }
# variable "region_cdn" { type = string default = "eu" }
# variable "r2_bucket"  { type = string default = "lokaltreu-dev-audit" }
