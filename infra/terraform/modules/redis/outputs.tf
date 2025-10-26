output "descriptor" {
  value = {
    datastore_name = terraform_data.descriptor.output.datastore_name
    region         = terraform_data.descriptor.output.region
    team_id        = terraform_data.descriptor.output.team_id
    tags           = terraform_data.descriptor.output.tags
  }
  description = "Upstash Redis descriptor with EU-only configuration."
}
