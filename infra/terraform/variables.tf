variable "config" {
  type = object({
    project               = string
    environment           = string
    naming_prefix         = optional(string)
    region_api            = string
    region_postgres       = string
    region_redis          = string
    region_storage        = string
    region_cdn            = string
    cloudflare_account_id = string
    cloudflare_api_token  = optional(string)
    fly_org_slug          = string
    fly_app_name          = optional(string)
    fly_access_token      = optional(string)
    mail_provider         = string
    mail_api_key          = optional(string)
    neon_project_id       = string
    neon_branch_name      = string
    neon_api_key          = optional(string)
    upstash_team_id       = string
    upstash_email         = optional(string)
    upstash_api_key       = optional(string)
    tags                  = optional(map(string))
  })
  description = "Normalized configuration map passed from environment modules."
}
