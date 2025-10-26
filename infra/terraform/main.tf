terraform {
  required_version = "~> 1.6.6"
}

# Hinweis:
# Die produktive Infrastruktur für lokaltreu-prod wird NICHT mehr
# aus diesem Root-Stack ausgerollt.
#
# Stattdessen wird jede Umgebung (dev/stage/prod) über
# infra/terraform/envs/<env>/main.tf in einem eigenen Terraform Cloud
# Workspace ausgeführt.
#
# Diese Datei ist absichtlich leer, damit Terraform Cloud beim Planen
# von envs/prod keine doppelten Module ohne Secrets lädt.
