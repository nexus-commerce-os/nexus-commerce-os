# =============================================================================
# prod env — outputs (per region)
# =============================================================================

output "primary" {
  description = "Primary us-east-1 region outputs."
  value = {
    cluster_name      = module.primary.cluster_name
    cluster_endpoint  = module.primary.cluster_endpoint
    oidc_provider_arn = module.primary.oidc_provider_arn
    db_writer         = module.primary.db_writer_endpoint
    db_reader         = module.primary.db_reader_endpoint
    egress_ips        = module.primary.egress_cell_public_ips
  }
}

output "dr" {
  description = "In-zone DR pair us-west-2 outputs."
  value = {
    cluster_name      = module.dr.cluster_name
    cluster_endpoint  = module.dr.cluster_endpoint
    oidc_provider_arn = module.dr.oidc_provider_arn
    db_writer         = module.dr.db_writer_endpoint
    egress_ips        = module.dr.egress_cell_public_ips
  }
}
