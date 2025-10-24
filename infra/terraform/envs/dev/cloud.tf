terraform {
  cloud {
    organization = "lokaltreu-eu"

    workspaces {
      name = "lokaltreu-dev"
    }
  }
}
