endpoints                   = { s3 = "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com" }
bucket                      = "<R2_BUCKET_NAME_EU>"
key                         = "state/prod/terraform.tfstate"
region                      = "auto"
use_path_style              = true
skip_requesting_account_id  = true
skip_region_validation       = true
skip_credentials_validation  = true
