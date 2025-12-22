locals {
  component  = "cache-redis"
  base_name  = "${var.project_name}-${var.env}"
  redis_name = "${local.base_name}-redis"
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
    engine    = "redis"
  })
}

resource "upstash_redis_database" "primary" {
  database_name = local.redis_name
  region        = var.region
  tls           = true
  consistent    = true
  multiregion   = false
  team_id       = var.team_id == "" ? null : var.team_id
}
