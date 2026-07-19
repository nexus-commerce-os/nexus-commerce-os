# =============================================================================
# global stack — org guardrails (SCP / AWS Config references)
# [09 §10]: SCPs deny prohibited regions/services; AWS Config rules detect
# drift/compliance; Control Tower provides the landing zone. These are
# ORGANIZATION-level and live in the MANAGEMENT/audit account — they are
# REFERENCED here (as data + documented policy JSON) so this stack stays
# deployable in a member account without org-admin rights.
#
# Two SCP policy documents are rendered as *artifacts* for the org admin to
# attach in the management account; attaching them requires organizations:*
# which a member-account deploy role deliberately does NOT have.
# =============================================================================

# ---- SCP artifact 1: deny operations outside approved residency regions ----
# Guardrail for NFR-PRIV-01 / ADR-0016: nothing may be created in a prohibited
# region. Global services (iam, cloudfront, route53, etc.) are exempted.
data "aws_iam_policy_document" "scp_region_deny" {
  count = length(var.prohibited_regions) > 0 ? 1 : 0

  statement {
    sid       = "DenyProhibitedRegions"
    effect    = "Deny"
    actions   = ["*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = var.prohibited_regions
    }

    # Exempt global services that are logically region-less.
    condition {
      test     = "ForAllValues:StringNotLike"
      variable = "aws:PrincipalServiceNamesList"
      values   = ["iam.amazonaws.com", "cloudfront.amazonaws.com", "route53.amazonaws.com"]
    }
  }
}

# ---- SCP artifact 2: mandatory-tags / no-untagged-data-store guardrail ----
# FinOps ([09 §9]): untagged resource = deny. Rendered as an artifact.
data "aws_iam_policy_document" "scp_require_tags" {
  statement {
    sid       = "DenyCreateWithoutOwnerTag"
    effect    = "Deny"
    actions   = ["s3:CreateBucket", "rds:CreateDBCluster", "elasticache:CreateReplicationGroup"]
    resources = ["*"]

    condition {
      test     = "Null"
      variable = "aws:RequestTag/owner"
      values   = ["true"]
    }
  }
}

# NOTE (Config / Control Tower): AWS Config rules (encryption-at-rest,
# no-public-S3, required-tags) and the Control Tower landing zone are managed in
# the org management account. This stack does not create them (member-account
# scope); it documents the required rule set for the org admin. See README.
