terraform {
  backend "s3" {
    bucket                      = "lokaltreu-terraform-state"
    key                         = "global/terraform.tfstate"
    region                      = "eu-central-1"
    endpoint                    = "https://s3.eu-central-1.amazonaws.com"
    encrypt                     = true
    skip_credentials_validation = true
    skip_region_validation      = false
  }
}
