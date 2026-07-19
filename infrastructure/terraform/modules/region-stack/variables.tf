# =============================================================================
# region-stack (composition) — inputs
# This is "the identical Terraform region module" the docs reference
# ([09 §6]: "instantiating the identical Terraform region module (with its
# in-zone DR pair)"). It wires the 8 primitives for ONE region, so an env
# stands up a region by instantiating this once (with a provider alias), and
# staging == prod BY CONSTRUCTION (same module, different tfvars).
# =============================================================================

variable "name_prefix" {
  description = "Region-unique prefix, e.g. \"nexus-staging-aps1\" (org-env-region)."
  type        = string
}

variable "tags" {
  description = "Mandatory cost + ownership tags applied to every resource in the region."
  type        = map(string)
}

# ---- network ----
variable "vpc_cidr" {
  description = "Region VPC CIDR."
  type        = string
}

variable "availability_zones" {
  description = "AZs (>=3) to span."
  type        = list(string)
}

variable "egress_cell_count" {
  description = "Egress-cell fleet size (0 => one per AZ)."
  type        = number
  default     = 0
}

variable "interface_endpoint_services" {
  description = "Interface VPC endpoint service short-names."
  type        = list(string)
  default     = ["ecr.api", "ecr.dkr", "sts", "logs", "secretsmanager", "kms"]
}

variable "enable_flow_logs" {
  description = "Enable VPC flow logs."
  type        = bool
  default     = true
}

# ---- security (KMS + secrets + IRSA) ----
variable "kms_keys" {
  description = "Per-domain KMS keys (must include keys named eks, rds, redis, msk, s3, secrets used below)."
  type = map(object({
    description             = string
    enable_rotation         = optional(bool, true)
    deletion_window_in_days = optional(number, 30)
    multi_region            = optional(bool, false)
  }))
}

variable "secrets" {
  description = "Secrets Manager containers (metadata only)."
  type = map(object({
    description          = string
    kms_key_purpose      = string
    recovery_window_days = optional(number, 30)
  }))
  default = {}
}

variable "irsa_roles" {
  description = "IRSA roles (scoped to K8s ServiceAccounts)."
  type = map(object({
    namespace          = string
    service_account    = string
    policy_arns        = optional(list(string), [])
    inline_policy_json = optional(string, "")
  }))
  default = {}
}

# ---- compute (EKS) ----
variable "cluster_version" {
  description = "EKS Kubernetes version."
  type        = string
}

variable "endpoint_public_access" {
  description = "Public EKS API endpoint (false in prod)."
  type        = bool
  default     = false
}

variable "public_access_cidrs" {
  description = "CIDRs for a public API endpoint (never 0.0.0.0/0 in prod)."
  type        = list(string)
  default     = []
}

variable "node_pools" {
  description = "EKS node pools (discovery/money/gpu-warm/spot split — ADR-0017 R-059/R-078)."
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
}

variable "cluster_addons" {
  description = "Pinned EKS managed add-ons."
  type = map(object({
    version           = string
    resolve_conflicts = optional(string, "OVERWRITE")
  }))
  default = {}
}

# ---- database (Aurora) ----
variable "db_engine_version" {
  description = "Aurora PostgreSQL engine version."
  type        = string
}

variable "db_instances" {
  description = "Aurora cluster members (writer + readers across AZs)."
  type = map(object({
    instance_class      = string
    promotion_tier      = optional(number, 15)
    publicly_accessible = optional(bool, false)
  }))
}

variable "db_backup_retention_days" {
  description = "Aurora backup/PITR retention."
  type        = number
  default     = 14
}

variable "db_deletion_protection" {
  description = "Aurora deletion protection."
  type        = bool
  default     = true
}

# ---- cache (Redis money/catalog) ----
variable "redis_engine_version" {
  description = "Redis/Valkey engine version."
  type        = string
  default     = "7.1"
}

variable "redis_clusters" {
  description = "Isolated Redis clusters (money + catalog — ADR-0017 R-082)."
  type = map(object({
    node_type               = string
    num_node_groups         = number
    replicas_per_node_group = number
    snapshot_retention      = optional(number, 7)
  }))
}

# ---- messaging (MSK) ----
variable "kafka_version" {
  description = "Apache Kafka version."
  type        = string
}

variable "msk_broker_count" {
  description = "MSK broker node count (>=3, multiple of AZ count)."
  type        = number
}

variable "msk_broker_instance_type" {
  description = "MSK broker instance type."
  type        = string
  default     = "kafka.m7g.large"
}

variable "msk_broker_ebs_volume_size" {
  description = "Per-broker EBS GiB."
  type        = number
  default     = 100
}

# ---- storage (S3) ----
variable "buckets" {
  description = "S3 buckets (mark personal-data buckets so CRR is blocked)."
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
  default = {}
}

variable "bucket_replication" {
  description = "Optional S3 CRR config (non-personal buckets only)."
  type = map(object({
    destination_bucket_arn  = string
    destination_kms_key_arn = string
  }))
  default = {}
}

variable "replication_role_arn" {
  description = "IAM role S3 assumes for CRR (required if bucket_replication set)."
  type        = string
  default     = ""
}

# ---- monitoring ----
variable "enable_managed_prometheus" {
  description = "Create an AMP workspace."
  type        = bool
  default     = true
}

variable "enable_managed_grafana" {
  description = "Create an AMG workspace."
  type        = bool
  default     = false
}
