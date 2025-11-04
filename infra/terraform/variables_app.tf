# Laufzeit-Umgebung
variable "env" {
  type = string
  validation {
    condition     = can(regex("^(dev|stage|prod)$", var.env))
    error_message = "env muss dev|stage|prod sein."
  }
}

# Upstash Zugang (sensitiv). Für terraform validate leere Defaults erlauben.
variable "upstash_redis_url" {
  type      = string
  sensitive = true
  default   = ""
}

variable "upstash_redis_token" {
  type      = string
  sensitive = true
  default   = ""
}
