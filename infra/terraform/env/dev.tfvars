# Umgebung
env = "dev"

# EU-Regionen
fly_primary_region = "fra"               # Fly: ams|cdg|fra|lhr|arn
neon_region        = "aws-eu-central-1"  # Neon: aws-eu-central-1|aws-eu-west-2|azure-gwc
r2_location_hint   = "weur"              # Cloudflare R2: weur|eeur
r2_jurisdiction    = "eu"

# Upstash App-Config (für locals in main.tf)
upstash_redis_url   = "https://eu-central-1-xxxx.upstash.io"
upstash_redis_token = "REPLACE_ME_TOKEN"

# Provider-Credentials (werden in providers.tf als var.* referenziert)
fly_token            = "REPLACE_ME_FLY_API_TOKEN"
neon_api_key         = "REPLACE_ME_NEON_API_KEY"
upstash_api_key      = "REPLACE_ME_UPSTASH_API_KEY"
cloudflare_api_token = "REPLACE_ME_CLOUDFLARE_API_TOKEN"
upstash_email = "you@example.com"

# region_api ist deine "Generalschalter"-Region. Wähle einen erlaubten Wert:
# z.B. "fra" (Fly), oder "aws-eu-central-1" (Neon), oder "weur" (R2 Hint), etc.


