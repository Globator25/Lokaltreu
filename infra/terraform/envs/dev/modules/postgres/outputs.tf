output "descriptor" {
  value = {
    project_id    = var.neon_project_id
    branch_name   = var.neon_branch_name
    database_name = var.database_name
    region        = var.region
    project       = var.project
    environment   = var.environment
    tags          = var.tags
  }
  description = "Neon Postgres descriptor including project, branch, database, region, and environment context."
}
