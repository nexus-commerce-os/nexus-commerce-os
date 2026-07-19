# =============================================================================
# staging env — inputs. Region names are variables (residency-explicit); sizing
# is the environment definition (locals in main.tf), kept prod-shaped.
# =============================================================================

variable "primary_region" {
  description = "Staging primary region (US corridor), mirrors prod primary."
  type        = string
  default     = "us-east-1"
}

variable "regulated_region" {
  description = "Regulated South-Asia region exercised in staging BEFORE the P4 market opens (ADR-0016 R-014). Mumbai."
  type        = string
  default     = "ap-south-1"
}

variable "regulated_dr_region" {
  description = "In-zone DR pair for the regulated region — SAME residency zone, never cross-residency (ADR-0016 R-013). Hyderabad."
  type        = string
  default     = "ap-south-2"
}

variable "owner_tag" {
  description = "Owning team for cost allocation."
  type        = string
  default     = "platform-team"
}
