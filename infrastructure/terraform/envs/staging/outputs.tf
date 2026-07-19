# =============================================================================
# staging env — outputs (per region)
# =============================================================================

output "primary" {
  description = "Primary (us-east-1) region outputs."
  value = {
    cluster_name      = module.primary.cluster_name
    cluster_endpoint  = module.primary.cluster_endpoint
    oidc_provider_arn = module.primary.oidc_provider_arn
    db_writer         = module.primary.db_writer_endpoint
    egress_ips        = module.primary.egress_cell_public_ips
  }
}

output "regulated" {
  description = "Regulated ap-south-1 tier outputs (residency)."
  value = {
    cluster_name      = module.regulated.cluster_name
    cluster_endpoint  = module.regulated.cluster_endpoint
    oidc_provider_arn = module.regulated.oidc_provider_arn
    db_writer         = module.regulated.db_writer_endpoint
    egress_ips        = module.regulated.egress_cell_public_ips
  }
}

output "regulated_dr" {
  description = "In-zone DR pair ap-south-2 outputs."
  value = {
    cluster_name     = module.regulated_dr.cluster_name
    cluster_endpoint = module.regulated_dr.cluster_endpoint
    db_writer        = module.regulated_dr.db_writer_endpoint
  }
}
