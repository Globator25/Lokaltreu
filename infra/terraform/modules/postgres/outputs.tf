output "descriptor" {
  value = {
    project_id    = terraform_data.descriptor.output.project_id
    branch_name   = terraform_data.descriptor.output.branch_name
    database_name = terraform_data.descriptor.output.database_name
    region        = terraform_data.descriptor.output.region
    tags          = terraform_data.descriptor.output.tags
  }
  description = "Neon Postgres descriptor scoped to EU operations."
}
