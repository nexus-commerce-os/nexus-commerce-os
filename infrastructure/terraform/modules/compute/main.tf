# =============================================================================
# compute module (EKS) — main
# Realizes [09 §3 compute]:
#   - Upstream Kubernetes on EKS (ADR-0003 anti-lock-in — pods, not PaaS).
#   - Node groups are data-driven from var.node_pools so the discovery-vs-money
#     split (ADR-0017 R-059), GPU warm floor (R-078), and Spot ingestion pool
#     are pure configuration.
#   - IRSA (IAM Roles for Service Accounts) via the cluster OIDC provider
#     ([09 §10] identity/least-privilege; consumed by the security module).
#
# This module provisions the cluster + node IAM + node groups + OIDC provider.
# In-cluster workloads (Helm/Argo) are OUT of scope ([10 §5] Terraform/Helm seam).
# =============================================================================

# ------------------------------------------------------------------ Cluster IAM role
data "aws_iam_policy_document" "cluster_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster" {
  name_prefix        = "${var.name_prefix}-eks-"
  assume_role_policy = data.aws_iam_policy_document.cluster_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "cluster" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
  ])
  role       = aws_iam_role.cluster.name
  policy_arn = each.value
}

# ------------------------------------------------------------------ Cluster security group
resource "aws_security_group" "cluster" {
  name_prefix = "${var.name_prefix}-eks-cp-"
  description = "EKS control-plane SG. Node<->control-plane only; default-deny otherwise."
  vpc_id      = data.aws_subnet.first_app.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-eks-cp-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

# Resolve the VPC from a provided subnet (module receives subnet ids, not vpc id).
data "aws_subnet" "first_app" {
  id = var.app_subnet_ids[0]
}

# ------------------------------------------------------------------ EKS cluster
resource "aws_eks_cluster" "this" {
  name     = var.name_prefix
  version  = var.cluster_version
  role_arn = aws_iam_role.cluster.arn

  vpc_config {
    subnet_ids              = var.app_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = var.endpoint_public_access
    public_access_cidrs     = var.endpoint_public_access ? var.public_access_cidrs : null
    security_group_ids      = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = var.cluster_log_types

  # Envelope-encrypt Kubernetes secrets with a customer-managed KMS key.
  dynamic "encryption_config" {
    for_each = var.cluster_encryption_kms_key_arn == "" ? [] : [1]
    content {
      provider {
        key_arn = var.cluster_encryption_kms_key_arn
      }
      resources = ["secrets"]
    }
  }

  tags = merge(var.tags, { Name = var.name_prefix })

  depends_on = [aws_iam_role_policy_attachment.cluster]
}

# ------------------------------------------------------------------ IRSA — OIDC provider
# The cluster's OIDC issuer lets each ServiceAccount assume a scoped IAM role
# (no node-wide creds, [09 §10]). Roles themselves are created in the SECURITY
# module, which consumes `oidc_provider_arn` from this module's outputs.
data "tls_certificate" "oidc" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "irsa" {
  url             = aws_eks_cluster.this.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.oidc.certificates[0].sha1_fingerprint]

  tags = merge(var.tags, { Name = "${var.name_prefix}-irsa" })
}

# ------------------------------------------------------------------ Node IAM role (shared by node groups)
data "aws_iam_policy_document" "node_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name_prefix        = "${var.name_prefix}-node-"
  assume_role_policy = data.aws_iam_policy_document.node_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "node" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    # NOTE: SSM for node access is preferred over SSH keys (no inbound 22).
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
  ])
  role       = aws_iam_role.node.name
  policy_arn = each.value
}

# ------------------------------------------------------------------ Managed node groups (data-driven)
resource "aws_eks_node_group" "this" {
  for_each = var.node_pools

  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.name_prefix}-${each.key}"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.app_subnet_ids

  instance_types = each.value.instance_types
  capacity_type  = each.value.capacity_type
  ami_type       = each.value.ami_type
  disk_size      = each.value.disk_size

  scaling_config {
    desired_size = each.value.desired_size
    min_size     = each.value.min_size # GPU-interactive/money keep a warm floor (>0)
    max_size     = each.value.max_size
  }

  # Blue-green upgrades: surge one node at a time; PDBs/topology-spread (Helm)
  # guarantee capacity during the drain ([10 §5] EKS lifecycle).
  update_config {
    max_unavailable = 1
  }

  labels = each.value.labels

  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-${each.key}"
    Pool = each.key
  })

  # desired_size drifts under cluster-autoscaler/Karpenter; don't fight it.
  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }

  depends_on = [aws_iam_role_policy_attachment.node]
}

# ------------------------------------------------------------------ Managed add-ons (pinned)
resource "aws_eks_addon" "this" {
  for_each = var.cluster_addons

  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = each.key
  addon_version               = each.value.version
  resolve_conflicts_on_update = each.value.resolve_conflicts

  tags = var.tags

  depends_on = [aws_eks_node_group.this]
}
