# =============================================================================
# monitoring module — main
# Realizes [09 §11] observability infra in a SEPARATE failure domain
# (ADR-0017 R-060). Managed AMP/AMG by default; self-host hooks (IRSA remote-
# write role) always available so a dedicated Prometheus/Grafana/Tempo/Loki
# stack can run on a distinct cluster with no autoscaling circular dependency.
# =============================================================================

locals {
  oidc_host      = replace(var.oidc_provider_url, "https://", "")
  make_collector = var.oidc_provider_arn != ""
}

# ------------------------------------------------------------------ Amazon Managed Prometheus (AMP)
resource "aws_prometheus_workspace" "this" {
  count = var.enable_managed_prometheus ? 1 : 0

  alias = "${var.name_prefix}-amp"
  tags  = merge(var.tags, { Name = "${var.name_prefix}-amp" })
}

# ------------------------------------------------------------------ Amazon Managed Grafana (AMG)
data "aws_iam_policy_document" "grafana_assume" {
  count = var.enable_managed_grafana ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["grafana.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "grafana" {
  count = var.enable_managed_grafana ? 1 : 0

  name_prefix        = "${var.name_prefix}-amg-"
  assume_role_policy = data.aws_iam_policy_document.grafana_assume[0].json
  tags               = var.tags
}

resource "aws_grafana_workspace" "this" {
  count = var.enable_managed_grafana ? 1 : 0

  name                     = "${var.name_prefix}-amg"
  account_access_type      = var.grafana_account_access_type
  authentication_providers = var.grafana_authentication_providers
  permission_type          = "SERVICE_MANAGED"
  role_arn                 = aws_iam_role.grafana[0].arn
  data_sources             = ["PROMETHEUS", "CLOUDWATCH"]

  tags = merge(var.tags, { Name = "${var.name_prefix}-amg" })
}

# ------------------------------------------------------------------ Collector IRSA (remote-write to AMP)
# Self-host hook AND managed-mode hook: the in-cluster OTel/Prometheus collector
# assumes this scoped role to remote-write to AMP. This is what keeps the
# metrics pipeline independent of the workloads it scrapes.
data "aws_iam_policy_document" "collector_assume" {
  count = local.make_collector ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:sub"
      values   = ["system:serviceaccount:${var.collector_namespace}:${var.collector_service_account}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "collector" {
  count = local.make_collector ? 1 : 0

  name_prefix        = "${var.name_prefix}-otel-"
  assume_role_policy = data.aws_iam_policy_document.collector_assume[0].json
  tags               = var.tags
}

data "aws_iam_policy_document" "collector_permissions" {
  count = local.make_collector && var.enable_managed_prometheus ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "aps:RemoteWrite",
      "aps:GetSeries",
      "aps:GetLabels",
      "aps:GetMetricMetadata",
    ]
    resources = [aws_prometheus_workspace.this[0].arn]
  }
}

resource "aws_iam_role_policy" "collector" {
  count = local.make_collector && var.enable_managed_prometheus ? 1 : 0

  name_prefix = "aps-remote-write-"
  role        = aws_iam_role.collector[0].id
  policy      = data.aws_iam_policy_document.collector_permissions[0].json
}

# ------------------------------------------------------------------ Alerting/rules audit log
resource "aws_cloudwatch_log_group" "alerts" {
  name              = "/nexus/observability/${var.name_prefix}/alerts"
  retention_in_days = var.alert_log_retention_days
  tags              = var.tags
}
