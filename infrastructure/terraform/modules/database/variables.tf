# =============================================================================
# database module (Aurora PostgreSQL) — inputs
# OLTP / ledger / catalog-projection SoR ([09 §5]). Standard-Postgres-only
# (no Aurora-proprietary features) to keep the portable-Postgres exit real
# (ADR-0003 portability caveat; ADR-0016 R-036 portable-DR proof).
# =============================================================================

variable "name_prefix" {
  description = "Prefix for cluster + instance names, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version (e.g. \"16.4\"). Pinned; upgrades are reviewed."
  type        = string
}

variable "data_subnet_ids" {
  description = "Private-data subnet ids (from network). Internet-isolated; MUST span >=3 AZs."
  type        = list(string)

  validation {
    condition     = length(var.data_subnet_ids) >= 2
    error_message = "Aurora requires subnets in multiple AZs (>=3 for staging/prod)."
  }
}

variable "vpc_id" {
  description = "VPC id (from network) for the DB security group."
  type        = string
}

variable "allowed_security_group_ids" {
  description = "App-tier SG ids permitted to reach Postgres (5432). Access is by SG-REFERENCE, not CIDR ([09 §4])."
  type        = list(string)
  default     = []
}

variable "instances" {
  description = "Map of cluster instances keyed by member name (e.g. { writer = {...}, reader-1 = {...} }). >=2 members across AZs for HA ([09 §8] multi-AZ)."
  type = map(object({
    instance_class      = string
    promotion_tier      = optional(number, 15) # lower = preferred failover target
    publicly_accessible = optional(bool, false)
  }))

  validation {
    condition     = length(var.instances) >= 1
    error_message = "At least one instance (the writer) is required."
  }
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key ARN (from security) for storage encryption at rest (NFR-SEC-01)."
  type        = string
}

variable "database_name" {
  description = "Initial database name."
  type        = string
  default     = "nexus"
}

variable "master_username" {
  description = "Master username. The PASSWORD is never set here — it is generated + stored in Secrets Manager by AWS (manage_master_user_password), so no secret ever touches state/Git ([09 §10] secrets)."
  type        = string
  default     = "nexus_admin"
}

variable "backup_retention_days" {
  description = "Automated backup / PITR retention window ([09 §8] backups+PITR)."
  type        = number
  default     = 14

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Retain >= 7 days of backups for a money/PII SoR."
  }
}

variable "deletion_protection" {
  description = "Block accidental cluster deletion. MUST be true in staging/prod (prevent_destroy is also set in main.tf)."
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights (observability, [09 §11])."
  type        = bool
  default     = true
}

variable "cluster_parameters" {
  description = "Cluster parameter-group overrides. Keep to STANDARD Postgres params to preserve portability."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny."
  type        = map(string)
}
