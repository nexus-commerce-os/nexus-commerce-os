# =============================================================================
# security module — outputs
# =============================================================================

output "kms_key_arns" {
  description = "KMS key ARNs keyed by purpose (feed to database/cache/messaging/storage/compute)."
  value       = { for k, key in aws_kms_key.this : k => key.arn }
}

output "kms_key_ids" {
  description = "KMS key ids keyed by purpose."
  value       = { for k, key in aws_kms_key.this : k => key.key_id }
}

output "kms_alias_names" {
  description = "KMS alias names keyed by purpose."
  value       = { for k, a in aws_kms_alias.this : k => a.name }
}

output "irsa_role_arns" {
  description = "IRSA role ARNs keyed by logical name (annotate the matching K8s ServiceAccount with these)."
  value       = { for k, r in aws_iam_role.irsa : k => r.arn }
}

output "secret_arns" {
  description = "Secrets Manager container ARNs keyed by name (ESO reads these; values never in state)."
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
}
