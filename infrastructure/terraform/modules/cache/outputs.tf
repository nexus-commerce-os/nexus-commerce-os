# =============================================================================
# cache module (ElastiCache Redis/Valkey) — outputs
# =============================================================================

output "primary_endpoints" {
  description = "Primary (write) endpoint address per cluster purpose, e.g. { money = ..., catalog = ... }."
  value       = { for k, g in aws_elasticache_replication_group.this : k => g.primary_endpoint_address }
}

output "reader_endpoints" {
  description = "Reader endpoint address per cluster purpose."
  value       = { for k, g in aws_elasticache_replication_group.this : k => g.reader_endpoint_address }
}

output "replication_group_ids" {
  description = "Replication group ids per purpose."
  value       = { for k, g in aws_elasticache_replication_group.this : k => g.id }
}

output "security_group_id" {
  description = "Cache SG id."
  value       = aws_security_group.this.id
}
