locals {
  database_name = format("%s_%s", replace(var.project, "-", "_"), var.environment)
  branch_name   = var.neon_branch_name
}

resource "terraform_data" "descriptor" {
  input = {
    project_id    = var.neon_project_id
    branch_name   = local.branch_name
    database_name = local.database_name
    region        = var.region
    tags          = var.tags
  }
}
