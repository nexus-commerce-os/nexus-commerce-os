# =============================================================================
# monitoring module — inputs
# Observability infra ([09 §11]) in a SEPARATE FAILURE DOMAIN off the critical
# path (ADR-0017 R-060): the autoscaler (HPA/KEDA) reads these metrics, so this
# stack MUST NOT depend on the workload clusters it watches.
#
# Two modes, both supported:
#   - MANAGED: Amazon Managed Prometheus (AMP) + Amazon Managed Grafana (AMG).
#   - SELF-HOST HOOKS: emit an IRSA role + workspace-less outputs so a dedicated
#     Prometheus/Grafana/Tempo/Loki stack (Helm) can run on a separate cluster.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for observability resources, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "enable_managed_prometheus" {
  description = "Create an Amazon Managed Prometheus (AMP) workspace. If false, self-host hooks are emitted instead."
  type        = bool
  default     = true
}

variable "enable_managed_grafana" {
  description = "Create an Amazon Managed Grafana (AMG) workspace. Requires AWS SSO/IAM Identity Center in the account."
  type        = bool
  default     = false
}

variable "grafana_account_access_type" {
  description = "AMG account access type: CURRENT_ACCOUNT or ORGANIZATION."
  type        = string
  default     = "CURRENT_ACCOUNT"
}

variable "grafana_authentication_providers" {
  description = "AMG auth providers, e.g. [\"AWS_SSO\"] or [\"SAML\"]."
  type        = list(string)
  default     = ["AWS_SSO"]
}

variable "alert_log_retention_days" {
  description = "Retention for the alerting/rules audit log group ([09 §11] retention is tunable)."
  type        = number
  default     = 90
}

variable "oidc_provider_arn" {
  description = "EKS IRSA OIDC provider ARN (from compute) for the metrics-collector / remote-write role. Empty skips the collector role (managed-only)."
  type        = string
  default     = ""
}

variable "oidc_provider_url" {
  description = "EKS IRSA OIDC issuer URL (host portion, from compute)."
  type        = string
  default     = ""
}

variable "collector_namespace" {
  description = "K8s namespace of the OTel/Prometheus collector ServiceAccount that remote-writes to AMP."
  type        = string
  default     = "observability"
}

variable "collector_service_account" {
  description = "K8s ServiceAccount name of the collector."
  type        = string
  default     = "otel-collector"
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny. Observability is itself a tagged cost center ([09 §11])."
  type        = map(string)
}
