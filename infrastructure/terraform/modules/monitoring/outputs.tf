# =============================================================================
# monitoring module — outputs
# =============================================================================

output "prometheus_workspace_id" {
  description = "AMP workspace id (empty when managed Prometheus is disabled)."
  value       = var.enable_managed_prometheus ? aws_prometheus_workspace.this[0].id : ""
}

output "prometheus_remote_write_endpoint" {
  description = "AMP remote-write endpoint for the collector (empty when disabled)."
  value       = var.enable_managed_prometheus ? aws_prometheus_workspace.this[0].prometheus_endpoint : ""
}

output "grafana_workspace_endpoint" {
  description = "AMG workspace endpoint (empty when managed Grafana is disabled)."
  value       = var.enable_managed_grafana ? aws_grafana_workspace.this[0].endpoint : ""
}

output "collector_role_arn" {
  description = "IRSA role ARN the in-cluster OTel/Prometheus collector assumes to remote-write (empty when no OIDC provider supplied)."
  value       = local.make_collector ? aws_iam_role.collector[0].arn : ""
}

output "alerts_log_group_name" {
  description = "CloudWatch log group for alerting/rules audit."
  value       = aws_cloudwatch_log_group.alerts.name
}
