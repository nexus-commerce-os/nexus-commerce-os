# =============================================================================
# cache module (ElastiCache Redis/Valkey) — inputs
# ADR-0017 R-082: money/auth/rate-limit state lives in a SEPARATE cluster from
# the high-churn catalog-invalidation cache, so a catalog stampede cannot evict
# session/auth state. This module takes a MAP of clusters and stamps each one
# identically-hardened; the isolation is expressed as two map entries.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for cluster names, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "vpc_id" {
  description = "VPC id (from network) for the cache security group."
  type        = string
}

variable "data_subnet_ids" {
  description = "Private-data subnet ids (from network). Internet-isolated; span >=3 AZs."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "App-tier SG ids permitted to reach Redis (6379). SG-reference, not CIDR."
  type        = list(string)
  default     = []
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key ARN (from security) for at-rest encryption."
  type        = string
}

variable "engine_version" {
  description = "Redis/Valkey engine version (OSS API only — no proprietary extensions, per portability caveat [09 §5])."
  type        = string
  default     = "7.1"
}

variable "clusters" {
  description = <<-EOT
    Map of isolated cache clusters keyed by purpose. The two canonical entries
    realize ADR-0017 R-082:
      money   = { ... }  # sessions/auth/rate-limit — protected, small, stable
      catalog = { ... }  # catalog-invalidation — high-churn, may stampede
    Each value:
      node_type              = string  — e.g. "cache.r7g.large" (Graviton)
      num_node_groups        = number  — shards (cluster mode)
      replicas_per_node_group = number — >=1 for failover (multi-AZ)
      snapshot_retention     = optional(number, 7)
  EOT
  type = map(object({
    node_type               = string
    num_node_groups         = number
    replicas_per_node_group = number
    snapshot_retention      = optional(number, 7)
  }))

  validation {
    condition     = alltrue([for k, v in var.clusters : v.replicas_per_node_group >= 1])
    error_message = "Each cluster needs >=1 replica per node group for automatic failover (multi-AZ)."
  }
}

# NOTE (posture honesty): ElastiCache here is TLS-encrypted (transit) + at-rest
# encrypted + security-group-restricted, but is NOT yet application-authenticated.
# Redis AUTH / user-group RBAC (aws_elasticache_user + user_group_ids) is a tracked
# P0.2 wiring task. The previous `auth_token_secret_arns` variable claimed "AUTH is
# enforced" but was never referenced — removed so code matches the real posture.

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny."
  type        = map(string)
}
