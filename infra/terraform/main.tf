locals {
  name_prefix = "lokaltreu-${var.env}"
  api_environment = {
    # ARCH verlangt Upstash Redis in EU fuer Anti-Replay, Rate-Limits, Queue.
    REDIS_URL   = var.upstash_redis_url
    REDIS_TOKEN = var.upstash_redis_token
  }
}

# TODO: Ressourcen folgen in späteren Schritten
