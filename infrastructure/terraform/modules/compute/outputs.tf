# =============================================================================
# compute module (EKS) — outputs
# =============================================================================

output "cluster_name" {
  description = "EKS cluster name."
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority" {
  description = "Base64 cluster CA data (for kubeconfig / Helm providers)."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "cluster_security_group_id" {
  description = "Additional control-plane security group id (this module's)."
  value       = aws_security_group.cluster.id
}

output "cluster_primary_security_group_id" {
  description = "EKS-managed cluster security group that all managed nodes inherit. Reference THIS from data modules' ingress rules so app->data is SG-referenced ([09 §4])."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "cluster_version" {
  description = "Kubernetes version of the control plane."
  value       = aws_eks_cluster.this.version
}

output "oidc_provider_arn" {
  description = "IRSA OIDC provider ARN. Feed to the security module to mint scoped ServiceAccount roles ([09 §10])."
  value       = aws_iam_openid_connect_provider.irsa.arn
}

output "oidc_provider_url" {
  description = "IRSA OIDC issuer URL (host portion is used in role trust conditions)."
  value       = aws_iam_openid_connect_provider.irsa.url
}

output "node_role_arn" {
  description = "Shared worker-node IAM role ARN."
  value       = aws_iam_role.node.arn
}

output "node_group_names" {
  description = "Provisioned managed node-group names, keyed by pool."
  value       = { for k, ng in aws_eks_node_group.this : k => ng.node_group_name }
}
