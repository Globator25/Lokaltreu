locals {
  redis_database = format("%s-%s", var.naming_prefix, "redis")
}

resource "terraform_data" "descriptor" {
  input = {
    datastore_name = local.redis_database
    region         = var.region
    team_id        = var.upstash_team_id
    tags           = var.tags
  }
}
