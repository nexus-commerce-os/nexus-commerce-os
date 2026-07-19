# =============================================================================
# global stack — inputs
# NO account ids or org ids are hardcoded; all are variables/data sources.
# =============================================================================

variable "org_slug" {
  description = "Short org identifier used to name global singletons (state bucket, lock table), e.g. \"nexus\"."
  type        = string
  default     = "nexus"
}

variable "state_region" {
  description = "Region that HOMES the Terraform remote state bucket + lock table (US residency zone for the control plane)."
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub organization/owner that owns the repo (OIDC `sub` is scoped to repo:<org>/<repo>:...). NEVER trust all of github."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name the deploy roles trust (e.g. \"nexus\")."
  type        = string
}

variable "deploy_roles" {
  description = <<-EOT
    Map of per-environment GitHub-Actions deploy roles keyed by env name. Each
    role is assumable ONLY from a specific repo + ref pattern via OIDC — no
    static keys ([10 §2] OIDC federation; ADR-0018 tight aud+ref conditions).
    Each value:
      allowed_ref_patterns = list(string)  # e.g. ["repo:org/repo:ref:refs/heads/main"]
                                            # or environment: "repo:org/repo:environment:prod"
      policy_arns          = optional(list(string), [])
      inline_policy_json   = optional(string, "")   # least-privilege deploy policy
      max_session_seconds  = optional(number, 3600)
  EOT
  type = map(object({
    allowed_ref_patterns = list(string)
    policy_arns          = optional(list(string), [])
    inline_policy_json   = optional(string, "")
    max_session_seconds  = optional(number, 3600)
  }))
}

variable "prohibited_regions" {
  description = "Regions an SCP should DENY (data-residency guardrail — deny anything outside the approved residency zones). Referenced by the guardrail doc/output; applied in the management account."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Mandatory cost + ownership tags for global resources."
  type        = map(string)

  validation {
    condition     = contains(keys(var.tags), "owner")
    error_message = "tags MUST include an \"owner\" key."
  }
}
