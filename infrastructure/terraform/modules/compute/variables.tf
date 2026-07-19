# =============================================================================
# compute module (EKS) — inputs
# Upstream Kubernetes on EKS (ADR-0003: no proprietary compute PaaS).
# Node groups are DATA-DRIVEN via a map, so the discovery/money/GPU/spot split
# (ADR-0017 R-059) is expressed as configuration, not copy-pasted resources.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for cluster + node resources, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "cluster_version" {
  description = "EKS control-plane Kubernetes version, e.g. \"1.30\". Bumps are blue-green + deprecated-API pre-checked ([10 §5], ADR-0019 R-019)."
  type        = string
}

variable "app_subnet_ids" {
  description = "Private-app subnet ids (from network module) where worker nodes and the control-plane ENIs live. MUST span >=3 AZs."
  type        = list(string)

  validation {
    condition     = length(var.app_subnet_ids) >= 2
    error_message = "Provide app subnets across multiple AZs (>=3 for staging/prod)."
  }
}

variable "endpoint_public_access" {
  description = "Whether the EKS API server is reachable publicly. SHOULD be false in prod (private API + bastion/SSM). Public CIDRs must be narrowed when true."
  type        = bool
  default     = false
}

variable "public_access_cidrs" {
  description = "CIDRs allowed to reach a public API endpoint (only used when endpoint_public_access = true). NEVER 0.0.0.0/0 in prod."
  type        = list(string)
  default     = []
}

variable "cluster_encryption_kms_key_arn" {
  description = "KMS key ARN (from security module) used for EKS secrets envelope-encryption at rest (NFR-SEC-01). Empty disables (dev only)."
  type        = string
  default     = ""
}

variable "cluster_log_types" {
  description = "EKS control-plane log types shipped to CloudWatch for audit ([09 §10])."
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "node_pools" {
  description = <<-EOT
    Map of node groups, keyed by pool name. This is where the BLAST-RADIUS split
    lives (ADR-0017 R-059): keep discovery (elastic) and money (strict-SLO) on
    SEPARATE pools with distinct taints/labels; GPU warm-floor never scales to
    zero (R-078); spot only for interruptible ingestion/batch.

    Each value:
      instance_types  = list(string) — e.g. ["m7g.large"] (Graviton where possible)
      capacity_type   = "ON_DEMAND" | "SPOT"
      desired_size    = number
      min_size        = number  — GPU interactive/money pools keep a WARM FLOOR (>0)
      max_size        = number
      disk_size       = number  — GiB
      ami_type        = string  — e.g. "AL2023_x86_64_STANDARD", "AL2023_ARM_64_STANDARD", "AL2023_x86_64_NVIDIA"
      labels          = map(string) — scheduling labels (e.g. { pool = "money" })
      taints          = list(object({ key=string, value=string, effect=string })) — effect in NO_SCHEDULE|PREFER_NO_SCHEDULE|NO_EXECUTE
  EOT
  type = map(object({
    instance_types = list(string)
    capacity_type  = optional(string, "ON_DEMAND")
    desired_size   = number
    min_size       = number
    max_size       = number
    disk_size      = optional(number, 50)
    ami_type       = optional(string, "AL2023_x86_64_STANDARD")
    labels         = optional(map(string), {})
    taints = optional(list(object({
      key    = string
      value  = string
      effect = string
    })), [])
  }))

  validation {
    condition     = alltrue([for k, v in var.node_pools : contains(["ON_DEMAND", "SPOT"], v.capacity_type)])
    error_message = "capacity_type must be ON_DEMAND or SPOT."
  }

  validation {
    condition     = alltrue([for k, v in var.node_pools : v.min_size <= v.desired_size && v.desired_size <= v.max_size])
    error_message = "For every pool: min_size <= desired_size <= max_size."
  }
}

variable "cluster_addons" {
  description = "Managed EKS add-ons with pinned versions (CNI/CoreDNS/kube-proxy/EBS-CSI). Pinning is required by the blue-green upgrade matrix (ADR-0019 R-019)."
  type = map(object({
    version           = string
    resolve_conflicts = optional(string, "OVERWRITE")
  }))
  default = {}
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny ([09 §9])."
  type        = map(string)
}
