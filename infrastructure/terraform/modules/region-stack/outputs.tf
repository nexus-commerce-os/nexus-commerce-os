# =============================================================================
# region-stack (composition) — outputs
# Surfaced for env-level outputs, cross-region wiring (DR pair, CRR), and the
# GitOps/Helm bootstrap that consumes cluster + endpoint data.
# =============================================================================

output "vpc_id" {
  description = "Region VPC id."
  value       = module.network.vpc_id
}

output "egress_cell_public_ips" {
  description = "Stable outbound EIPs (partner allowlist)."
  value       = module.network.egress_cell_public_ips
}

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.compute.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API endpoint."
  value       = module.compute.cluster_endpoint
}

output "oidc_provider_arn" {
  description = "IRSA OIDC provider ARN."
  value       = module.compute.oidc_provider_arn
}

output "kms_key_arns" {
  description = "Per-domain KMS key ARNs."
  value       = module.security_keys.kms_key_arns
}

output "irsa_role_arns" {
  description = "IRSA role ARNs keyed by logical name."
  value       = module.security_irsa.irsa_role_arns
}

output "db_writer_endpoint" {
  description = "Aurora writer endpoint."
  value       = module.database.writer_endpoint
}

output "db_reader_endpoint" {
  description = "Aurora reader endpoint."
  value       = module.database.reader_endpoint
}

output "db_master_user_secret_arn" {
  description = "Aurora master credential secret ARN (ESO)."
  value       = module.database.master_user_secret_arn
}

output "redis_primary_endpoints" {
  description = "Redis primary endpoints by purpose (money/catalog)."
  value       = module.cache.primary_endpoints
}

output "kafka_bootstrap_brokers_sasl_iam" {
  description = "MSK IAM SASL bootstrap brokers."
  value       = module.messaging.bootstrap_brokers_sasl_iam
}

output "bucket_arns" {
  description = "S3 bucket ARNs by purpose."
  value       = module.storage.bucket_arns
}

output "prometheus_remote_write_endpoint" {
  description = "AMP remote-write endpoint."
  value       = module.monitoring.prometheus_remote_write_endpoint
}
