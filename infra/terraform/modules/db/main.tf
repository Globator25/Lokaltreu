locals {
  component     = "db-postgres"
  base_name     = "${var.project_name}-${var.env}"
  database_name = trimspace(var.db_name) != "" ? var.db_name : replace(lower("${local.base_name}-primary"), "-", "_")
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    engine    = "postgresql"
  })
}

resource "neon_project" "primary" {
  name      = local.database_name
  region_id = var.region
}

resource "neon_branch" "primary" {
  name       = var.branch_name
  project_id = neon_project.primary.id
}

resource "neon_database" "primary" {
  name      = local.database_name
  branch_id = neon_branch.primary.id
}

resource "neon_endpoint" "primary" {
  branch_id = neon_branch.primary.id
  type      = "read_write"
}
