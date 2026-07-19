# =============================================================================
# global stack — GitHub Actions OIDC + least-privilege deploy roles
# [10 §2]: "Runners authenticate to AWS via OIDC federation — no long-lived
# cloud credentials in CI." ADR-0018: tokens are short-lived with tight
# audience + branch/ref conditions (a PR-branch token cannot assume a prod role).
# THERE ARE NO STATIC ACCESS KEYS ANYWHERE IN THIS STACK.
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# GitHub's OIDC IdP. Thumbprint derived live from the JWKS TLS cert.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = merge(var.tags, { Name = "${var.org_slug}-github-oidc" })
}

# One deploy role per environment. The trust policy pins BOTH:
#   - aud  = sts.amazonaws.com
#   - sub  = repo:<org>/<repo>:<ref-pattern>   (branch OR environment scoped)
# so only the intended repo + ref/environment can assume it (ADR-0018 R-065).
data "aws_iam_policy_document" "deploy_assume" {
  for_each = var.deploy_roles

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Ref/environment scoping — the security boundary between envs.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value.allowed_ref_patterns
    }
  }
}

resource "aws_iam_role" "deploy" {
  for_each = var.deploy_roles

  name                 = "${var.org_slug}-deploy-${each.key}"
  assume_role_policy   = data.aws_iam_policy_document.deploy_assume[each.key].json
  max_session_duration = each.value.max_session_seconds

  tags = merge(var.tags, {
    Name = "${var.org_slug}-deploy-${each.key}"
    Env  = each.key
  })
}

resource "aws_iam_role_policy_attachment" "deploy" {
  for_each = merge([
    for role_key, role in var.deploy_roles : {
      for arn in role.policy_arns : "${role_key}::${arn}" => {
        role = role_key
        arn  = arn
      }
    }
  ]...)

  role       = aws_iam_role.deploy[each.value.role].name
  policy_arn = each.value.arn
}

resource "aws_iam_role_policy" "deploy_inline" {
  for_each = { for k, v in var.deploy_roles : k => v if v.inline_policy_json != "" }

  name   = "least-priv-deploy"
  role   = aws_iam_role.deploy[each.key].id
  policy = each.value.inline_policy_json
}
