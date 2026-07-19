# =============================================================================
# network module — inputs
# Every value is a variable or derived; NO hardcoded CIDRs, AZs, or account ids.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for all resource names, e.g. \"nexus-prod-use1\". Encodes org+env+region so multi-region composition never collides."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,40}$", var.name_prefix))
    error_message = "name_prefix must be lower-kebab, 3-41 chars, starting with a letter."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the region VPC (one VPC per region, [09 §4]). Must be a /16../20 to leave room for a 3-tier x >=3 AZ split."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && tonumber(split("/", var.vpc_cidr)[1]) <= 20
    error_message = "vpc_cidr must be a valid CIDR of prefix length /20 or larger (e.g. 10.0.0.0/16)."
  }
}

variable "availability_zones" {
  description = "AZ names to spread the three subnet tiers across. MUST be >= 3 (NFR-AVAIL-01; single-AZ is prohibited in staging/prod, [09 §8])."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 AZs are required; single-/dual-AZ deploys are prohibited in staging/prod."
  }
}

variable "public_subnet_newbits" {
  description = "Bits added to vpc_cidr prefix to size each PUBLIC subnet (edge/ALB/NAT tier). Subnets are derived with cidrsubnet(), never hardcoded."
  type        = number
  default     = 4
}

variable "app_subnet_newbits" {
  description = "Bits added to vpc_cidr prefix to size each PRIVATE-APP subnet (EKS nodes)."
  type        = number
  default     = 4
}

variable "data_subnet_newbits" {
  description = "Bits added to vpc_cidr prefix to size each PRIVATE-DATA subnet (Aurora/Redis/MSK — no internet route)."
  type        = number
  default     = 4
}

variable "egress_cell_count" {
  description = "Number of horizontally-scaled EGRESS CELLS (NAT gateways) to provision (ADR-0017 R-020: egress is a fleet, not a single chokepoint). Default one per AZ for HA; losing a cell reroutes. Set to 1 only for cost-capped dev."
  type        = number
  default     = 0 # 0 => one cell per AZ (computed in main.tf). Any >0 caps the fleet size.

  validation {
    condition     = var.egress_cell_count >= 0
    error_message = "egress_cell_count must be >= 0 (0 means one cell per AZ)."
  }
}

variable "interface_endpoint_services" {
  description = "AWS service short-names to expose as INTERFACE VPC endpoints in the data tier so managed-service traffic stays on the AWS backbone (PrivateLink, [09 §4]) instead of egressing. e.g. [\"ecr.api\",\"ecr.dkr\",\"sts\",\"logs\",\"secretsmanager\",\"kms\"]."
  type        = list(string)
  default     = []
}

variable "enable_flow_logs" {
  description = "Emit VPC Flow Logs to CloudWatch for the audit trail ([09 §10] CloudTrail/central logging). SHOULD be true in staging/prod."
  type        = bool
  default     = true
}

variable "flow_log_retention_days" {
  description = "Retention for VPC Flow Log group. Tune per compliance ([09 §11])."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Mandatory cost + ownership tags (team/service/env/region). Untagged resources are DENIED by SCP ([09 §9] FinOps). Merged onto every resource."
  type        = map(string)

  validation {
    condition     = contains(keys(var.tags), "env") && contains(keys(var.tags), "owner")
    error_message = "tags MUST include at least \"env\" and \"owner\" keys (FinOps allocation < 5% unallocated, [09 §9])."
  }
}
