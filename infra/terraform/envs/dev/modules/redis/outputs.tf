output "descriptor" {
  value = {
    datastore_name = var.datastore_name
    region         = var.region
    team_id        = var.upstash_team_id
    project        = var.project
    environment    = var.environment
    tags           = var.tags
  }
  description = "Upstash Redis descriptor including datastore, region, team, and project context."
}
