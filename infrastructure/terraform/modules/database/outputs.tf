# =============================================================================
# database module (Aurora PostgreSQL) — outputs
# =============================================================================

output "cluster_arn" {
  description = "Aurora cluster ARN."
  value       = aws_rds_cluster.this.arn
}

output "cluster_identifier" {
  description = "Aurora cluster identifier."
  value       = aws_rds_cluster.this.cluster_identifier
}

output "writer_endpoint" {
  description = "Cluster writer endpoint (write-home OLTP, [09 §6])."
  value       = aws_rds_cluster.this.endpoint
}

output "reader_endpoint" {
  description = "Cluster reader endpoint (load-balanced replicas)."
  value       = aws_rds_cluster.this.reader_endpoint
}

output "port" {
  description = "Database port."
  value       = aws_rds_cluster.this.port
}

output "database_name" {
  description = "Initial database name."
  value       = aws_rds_cluster.this.database_name
}

output "master_user_secret_arn" {
  description = "Secrets Manager ARN holding the AWS-managed master credentials. Consumed via External Secrets Operator into K8s — never read into Terraform state as plaintext."
  value       = aws_rds_cluster.this.master_user_secret[0].secret_arn
}

output "security_group_id" {
  description = "Aurora SG id (for observability / bastion SG-reference wiring)."
  value       = aws_security_group.this.id
}
