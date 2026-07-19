# =============================================================================
# security module — inputs
# The cloud-plane security primitives ([09 §10]): customer-managed KMS keys,
# IRSA roles (scoped pod identity), and Secrets Manager *containers* (metadata
# only — VALUES are never authored here; they arrive via rotation/ESO).
# Policy (who-can-do-what rules) is OWNED BY [08 Security]; this module plumbs.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for KMS aliases, roles, secrets, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "kms_keys" {
  description = <<-EOT
    Map of customer-managed KMS keys keyed by purpose (e.g. rds, redis, msk, s3,
    eks, secrets). Separate keys per data domain limit blast radius of a key
    compromise. Each value:
      description             = string
      enable_rotation         = optional(bool, true)
      deletion_window_in_days = optional(number, 30)
      multi_region            = optional(bool, false)  # true for keys backing
                                                        # cross-region (non-personal) data
  EOT
  type = map(object({
    description             = string
    enable_rotation         = optional(bool, true)
    deletion_window_in_days = optional(number, 30)
    multi_region            = optional(bool, false)
  }))
}

variable "oidc_provider_arn" {
  description = "EKS IRSA OIDC provider ARN (from compute module). Required when irsa_roles is non-empty."
  type        = string
  default     = ""
}

variable "oidc_provider_url" {
  description = "EKS IRSA OIDC issuer URL (host portion, from compute). Used in role trust conditions."
  type        = string
  default     = ""
}

variable "irsa_roles" {
  description = <<-EOT
    Map of IRSA roles keyed by logical name. Each role trusts ONE Kubernetes
    ServiceAccount (namespace + name) via the OIDC provider — no node-wide creds
    ([09 §10]). Each value:
      namespace           = string
      service_account     = string
      policy_arns         = optional(list(string), [])  # managed/customer policy ARNs
      inline_policy_json  = optional(string, "")         # least-privilege inline doc
  EOT
  type = map(object({
    namespace          = string
    service_account    = string
    policy_arns        = optional(list(string), [])
    inline_policy_json = optional(string, "")
  }))
  default = {}
}

variable "secrets" {
  description = <<-EOT
    Map of Secrets Manager secret CONTAINERS keyed by name. Only metadata is
    created (name, description, KMS key, rotation window) — NO secret_string is
    ever set here, so no value can land in state or Git. Values are written by
    rotation Lambdas / external processes; workloads read via ESO. Each value:
      description       = string
      kms_key_purpose   = string   # which kms_keys entry encrypts it
      recovery_window_days = optional(number, 30)
  EOT
  type = map(object({
    description          = string
    kms_key_purpose      = string
    recovery_window_days = optional(number, 30)
  }))
  default = {}
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny."
  type        = map(string)
}
