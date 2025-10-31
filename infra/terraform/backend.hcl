# Beispiel für S3-kompatibles Backend in EU (nur Vorlage!)
bucket         = "lokaltreu-tfstate"      # in EU-Bucket anlegen
key            = "global/terraform.tfstate"
region         = "eu-central-1"
endpoint       = "https://<eu-endpoint>"  # falls S3-kompatibel
skip_credentials_validation = true
skip_region_validation      = true
