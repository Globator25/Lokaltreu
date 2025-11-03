resource "neon_project" "db" {
  name      = "${var.name_prefix}-pg"
  region_id = var.neon_region # <- richtig: region_id
  # optional aber empfohlen:
  # org_id = var.neon_org_id
}


# Optional Neon branch inheriting region from project
resource "neon_branch" "main" {
  project_id = neon_project.db.id
  name       = "main"
}



