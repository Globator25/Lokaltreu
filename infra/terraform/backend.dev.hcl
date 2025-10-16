bucket  = "lokaltreu-terraform-state"
key     = "state/dev/terraform.tfstate"
region  = "auto"

# R2: neuer Schlüssel 'endpoints' statt 'endpoint'
endpoints = { s3 = "https://e0d59794904b2e465dd4c232c5a60551.r2.cloudflarestorage.com" }

# R2-kompatible Flags
use_path_style               = true
skip_requesting_account_id   = true
skip_credentials_validation  = true
skip_region_validation       = true
skip_metadata_api_check      = true
workspace_key_prefix         = ""
