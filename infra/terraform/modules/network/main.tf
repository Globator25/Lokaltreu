locals {
  component    = "network"
  base_name    = "${var.project_name}-${var.env}"
  network_name = "${local.base_name}-${local.component}"
  tags = merge(var.tags, {
    component = local.component
    env       = var.env
  })
}

# TODO: Define EU-only network primitives (VPCs/Subnets/Security-Groups) once the target provider is fixed.
# The architecture blueprint expects private networking for the modular monolith and managed services.
