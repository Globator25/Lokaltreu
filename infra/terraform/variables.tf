variable "fly_primary_region" {
  type = string
  validation {
    condition     = can(regex("^(ams|cdg|fra|lhr|arn)$", var.fly_primary_region))
    error_message = "Fly-Region muss EU sein."
  }
}

variable "neon_region" {
  type = string
  validation {
    condition     = can(regex("^(aws-eu-central-1|aws-eu-west-2|azure-gwc)$", var.neon_region))
    error_message = "Neon-Region muss EU sein."
  }
}

variable "r2_location_hint" {
  type    = string
  default = "weur"
  validation {
    condition     = can(regex("^(weur|eeur)$", var.r2_location_hint))
    error_message = "R2 Location Hint muss weur oder eeur sein."
  }
}

variable "r2_jurisdiction" {
  type    = string
  default = "eu"
  validation {
    condition     = can(regex("^eu$", var.r2_jurisdiction))
    error_message = "R2 Jurisdiction muss 'eu' sein."
  }
}
