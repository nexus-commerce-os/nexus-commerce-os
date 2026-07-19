# =============================================================================
# storage module (S3) — outputs
# =============================================================================

output "bucket_ids" {
  description = "Bucket names keyed by purpose."
  value       = { for k, b in aws_s3_bucket.this : k => b.id }
}

output "bucket_arns" {
  description = "Bucket ARNs keyed by purpose (feed to IRSA policies in security)."
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
}

output "bucket_domain_names" {
  description = "Regional bucket domain names keyed by purpose."
  value       = { for k, b in aws_s3_bucket.this : k => b.bucket_regional_domain_name }
}
