# =============================================================================
# dev env — inputs (only the few things that vary per deployment/account).
# Sizing/CIDRs are the ENVIRONMENT DEFINITION and live as locals in main.tf.
# =============================================================================

variable "aws_region" {
  description = "Primary region for dev. Single-region ([10 §1]: dev is one region)."
  type        = string
  default     = "us-east-1"
}

variable "owner_tag" {
  description = "Owning team for cost allocation (FinOps, [09 §9])."
  type        = string
  default     = "platform-team"
}

variable "vpc_cidr" {
  description = "Dev VPC CIDR (small; single region)."
  type        = string
  default     = "10.10.0.0/16"
}
