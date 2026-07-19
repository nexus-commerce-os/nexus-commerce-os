# =============================================================================
# prod env — inputs. Region names explicit (Phase-1 US residency pair).
# Additional residency zones (EU, South-Asia, ...) are added phase-by-phase by
# instantiating the SAME region-stack with its own provider alias + in-zone DR
# pair, gated by the region-before-market gate ([09 §6], ADR-0016 R-014).
# =============================================================================

variable "primary_region" {
  description = "Prod primary region (Phase-1 US). us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "In-zone DR pair for the US residency zone — same residency, AZ-independent region (ADR-0016 R-013). us-west-2."
  type        = string
  default     = "us-west-2"
}

variable "owner_tag" {
  description = "Owning team for cost allocation."
  type        = string
  default     = "platform-team"
}
