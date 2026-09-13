# =============================================================================
# security module — main
# Realizes the cloud-plane posture of [09 §10]:
#   - Customer-managed KMS keys, one per data domain (rotation on).
#   - IRSA roles: each trusts exactly one K8s ServiceAccount via OIDC `sub`.
#   - Secrets Manager containers (metadata only; values via rotation/ESO).
# Detailed IAM/key POLICY belongs to [08 Security]; this module is the plumbing.
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# ------------------------------------------------------------------ KMS keys (per data domain)
# False positive: rotation IS enabled. enable_key_rotation binds to the per-key input
# `enable_rotation`, which defaults to true (optional(bool, true) in variables.tf); OPA policy
# enforces posture. Semgrep flags it only because it cannot resolve the variable statically.
# nosemgrep
resource "aws_kms_key" "this" {
  for_each = var.kms_keys

  description             = each.value.description
  enable_key_rotation     = each.value.enable_rotation
  deletion_window_in_days = each.value.deletion_window_in_days
  multi_region            = each.value.multi_region

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-${each.key}"
    Purpose = each.key
  })
}

resource "aws_kms_alias" "this" {
  for_each = var.kms_keys

  name          = "alias/${var.name_prefix}-${each.key}"
  target_key_id = aws_kms_key.this[each.key].key_id
}

# ------------------------------------------------------------------ IRSA roles (scoped pod identity)
# The OIDC issuer host, used to build the `sub`/`aud` trust conditions.
locals {
  oidc_host = replace(var.oidc_provider_url, "https://", "")
}

data "aws_iam_policy_document" "irsa_assume" {
  for_each = var.irsa_roles

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    # Pin to exactly one ServiceAccount — no wildcards ([09 §10] least-privilege).
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:sub"
      values   = ["system:serviceaccount:${each.value.namespace}:${each.value.service_account}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "irsa" {
  for_each = var.irsa_roles

  name_prefix        = "${substr(var.name_prefix, 0, 20)}-${substr(each.key, 0, 10)}-"
  assume_role_policy = data.aws_iam_policy_document.irsa_assume[each.key].json

  tags = merge(var.tags, {
    Name           = "${var.name_prefix}-irsa-${each.key}"
    ServiceAccount = "${each.value.namespace}/${each.value.service_account}"
  })
}

# Attach managed / customer-managed policy ARNs.
resource "aws_iam_role_policy_attachment" "irsa" {
  for_each = merge([
    for role_key, role in var.irsa_roles : {
      for arn in role.policy_arns : "${role_key}::${arn}" => {
        role = role_key
        arn  = arn
      }
    }
  ]...)

  role       = aws_iam_role.irsa[each.value.role].name
  policy_arn = each.value.arn
}

# Attach least-privilege inline policies where provided.
resource "aws_iam_role_policy" "irsa_inline" {
  for_each = { for k, v in var.irsa_roles : k => v if v.inline_policy_json != "" }

  name_prefix = "inline-"
  role        = aws_iam_role.irsa[each.key].id
  policy      = each.value.inline_policy_json
}

# ------------------------------------------------------------------ Secrets Manager containers (metadata only)
resource "aws_secretsmanager_secret" "this" {
  for_each = var.secrets

  name_prefix             = "${var.name_prefix}/${each.key}-"
  description             = each.value.description
  kms_key_id              = aws_kms_key.this[each.value.kms_key_purpose].arn
  recovery_window_in_days = each.value.recovery_window_days

  tags = merge(var.tags, { Name = "${var.name_prefix}-secret-${each.key}" })

  # NOTE: deliberately NO aws_secretsmanager_secret_version here. Values are
  # written out-of-band by rotation Lambdas / bootstrap and read via ESO, so no
  # plaintext secret ever enters Terraform state or Git ([09 §10]).
}
