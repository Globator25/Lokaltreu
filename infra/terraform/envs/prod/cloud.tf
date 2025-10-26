terraform {
  cloud {
    organization = "lokaltreu-eu"

    workspaces {
      name = "lokaltreu-prod"
    }
  }
}
