# =============================================================================
# storage module (S3) — inputs
# Object store for images, feed files, backups, lake ([09 §5]). Versioned,
# KMS-encrypted, public-access-blocked, TLS-only, with OPTIONAL cross-region
# replication for globally-needed NON-personal assets ([09 §6]: S3 CRR for
# non-personal only; personal data never leaves its residency zone).
# =============================================================================

variable "name_prefix" {
  description = "Prefix for bucket names, e.g. \"nexus-prod-use1\". Combined with each key + a random suffix for global uniqueness."
  type        = string
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key ARN (from security) for SSE-KMS on every bucket."
  type        = string
}

variable "buckets" {
  description = <<-EOT
    Map of logical buckets keyed by purpose (e.g. images, feeds, backups, lake).
    Each value:
      versioning            = optional(bool, true)
      contains_personal_data = optional(bool, false)  # if true, CRR is FORBIDDEN
                                                       # (residency, ADR-0016 R-013)
      lifecycle_rules = optional(list(object({
        id                        = string
        prefix                    = optional(string, "")
        transition_days           = optional(number)
        transition_storage_class  = optional(string, "INTELLIGENT_TIERING")
        expiration_days           = optional(number)
        noncurrent_expiration_days = optional(number, 90)
      })), [])
  EOT
  type = map(object({
    versioning             = optional(bool, true)
    contains_personal_data = optional(bool, false)
    lifecycle_rules = optional(list(object({
      id                         = string
      prefix                     = optional(string, "")
      transition_days            = optional(number)
      transition_storage_class   = optional(string, "INTELLIGENT_TIERING")
      expiration_days            = optional(number)
      noncurrent_expiration_days = optional(number, 90)
    })), [])
  }))
}

variable "replication" {
  description = <<-EOT
    Optional cross-region replication config keyed by bucket purpose. A key may
    only be present for a bucket whose contains_personal_data = false (validated).
    Each value:
      destination_bucket_arn = string  — pre-existing dest bucket in the peer region
      destination_kms_key_arn = string — dest-region CMK
    Requires an IAM replication role (replication_role_arn).
  EOT
  type = map(object({
    destination_bucket_arn  = string
    destination_kms_key_arn = string
  }))
  default = {}
}

variable "replication_role_arn" {
  description = "IAM role ARN (from security/global) S3 assumes to replicate. Required when var.replication is non-empty."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny."
  type        = map(string)
}
