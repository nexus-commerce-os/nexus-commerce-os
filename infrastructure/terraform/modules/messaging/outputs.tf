# =============================================================================
# messaging module (MSK) — outputs
# =============================================================================

output "cluster_arn" {
  description = "MSK cluster ARN."
  value       = aws_msk_cluster.this.arn
}

output "bootstrap_brokers_tls" {
  description = "TLS bootstrap broker connection string (port 9094)."
  value       = aws_msk_cluster.this.bootstrap_brokers_tls
}

output "bootstrap_brokers_sasl_iam" {
  description = "IAM SASL bootstrap broker connection string (port 9098) — preferred, no static creds."
  value       = aws_msk_cluster.this.bootstrap_brokers_sasl_iam
}

output "security_group_id" {
  description = "MSK broker SG id."
  value       = aws_security_group.this.id
}

output "configuration_arn" {
  description = "MSK server-properties configuration ARN."
  value       = aws_msk_configuration.this.arn
}
