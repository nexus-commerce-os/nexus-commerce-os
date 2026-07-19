# =============================================================================
# dev env — outputs (consumed by the GitOps/Helm bootstrap)
# =============================================================================

output "region" {
  description = "Dev region."
  value       = var.aws_region
}

output "cluster_name" {
  description = "Dev EKS cluster name."
  value       = module.primary.cluster_name
}

output "cluster_endpoint" {
  description = "Dev EKS API endpoint."
  value       = module.primary.cluster_endpoint
}

output "oidc_provider_arn" {
  description = "Dev IRSA OIDC provider ARN."
  value       = module.primary.oidc_provider_arn
}

output "egress_cell_public_ips" {
  description = "Dev outbound EIPs (partner allowlist)."
  value       = module.primary.egress_cell_public_ips
}

output "db_writer_endpoint" {
  description = "Dev Aurora writer endpoint."
  value       = module.primary.db_writer_endpoint
}

output "redis_primary_endpoints" {
  description = "Dev Redis endpoints (money/catalog)."
  value       = module.primary.redis_primary_endpoints
}
