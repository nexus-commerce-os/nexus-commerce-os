# =============================================================================
# global stack — outputs
# =============================================================================

output "tfstate_bucket" {
  description = "Remote state S3 bucket name — paste into every env backend.tf."
  value       = aws_s3_bucket.tfstate.id
}

output "tflock_table" {
  description = "DynamoDB state-lock table name — paste into every env backend.tf."
  value       = aws_dynamodb_table.tflock.id
}

output "tfstate_kms_key_arn" {
  description = "KMS key ARN encrypting remote state."
  value       = aws_kms_key.tfstate.arn
}

output "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "deploy_role_arns" {
  description = "Per-env GitHub Actions deploy role ARNs (keyed by env). Reference these in the workflow's role-to-assume."
  value       = { for k, r in aws_iam_role.deploy : k => r.arn }
}

output "scp_region_deny_json" {
  description = "Rendered SCP artifact denying prohibited regions (empty if none). Attach in the ORG management account."
  value       = length(var.prohibited_regions) > 0 ? data.aws_iam_policy_document.scp_region_deny[0].json : ""
}

output "scp_require_tags_json" {
  description = "Rendered SCP artifact requiring an owner tag on new data stores. Attach in the ORG management account."
  value       = data.aws_iam_policy_document.scp_require_tags.json
}
