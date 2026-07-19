# =============================================================================
# dev env — composition
# Single region, scaled-down ([10 §1] dev: "smaller node pools, single region").
# Composes ONE region-stack. Synthetic/anonymized data only ([10 data handling]).
# =============================================================================

locals {
  name_prefix = "nexus-dev-use1"

  # >=3 AZs even in dev so module validations pass and topology matches prod.
  azs = slice(data.aws_availability_zones.available.names, 0, 3)

  tags = {
    env     = "dev"
    owner   = var.owner_tag
    service = "platform"
  }
}

module "primary" {
  source = "../../modules/region-stack"

  name_prefix        = local.name_prefix
  tags               = local.tags
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.azs

  # Cost-capped egress in dev: a single cell is acceptable (not prod-HA).
  egress_cell_count = 1
  enable_flow_logs  = false

  # ---- KMS (per-domain, required names) ----
  kms_keys = {
    eks     = { description = "dev EKS secrets" }
    rds     = { description = "dev Aurora" }
    redis   = { description = "dev Redis" }
    msk     = { description = "dev MSK" }
    s3      = { description = "dev S3" }
    secrets = { description = "dev Secrets Manager" }
  }

  # ---- EKS ----
  cluster_version        = "1.30"
  endpoint_public_access = true
  public_access_cidrs    = [] # tighten to office/VPN CIDRs before use; never 0.0.0.0/0

  node_pools = {
    # Even in dev, keep the discovery/money split so scheduling matches prod.
    money = {
      instance_types = ["m7g.large"]
      desired_size   = 1
      min_size       = 1
      max_size       = 2
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "money" }
      taints         = [{ key = "pool", value = "money", effect = "NO_SCHEDULE" }]
    }
    discovery = {
      instance_types = ["c7g.large"]
      desired_size   = 1
      min_size       = 1
      max_size       = 3
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "discovery" }
    }
  }

  cluster_addons = {
    vpc-cni    = { version = "v1.18.1-eksbuild.3" }
    coredns    = { version = "v1.11.1-eksbuild.9" }
    kube-proxy = { version = "v1.30.0-eksbuild.3" }
  }

  # ---- Aurora (single small writer; no reader in dev) ----
  db_engine_version        = "16.4"
  db_backup_retention_days = 7
  db_deletion_protection   = false
  db_instances = {
    writer = { instance_class = "db.r7g.large", promotion_tier = 0 }
  }

  # ---- Redis (money + catalog, minimal) ----
  redis_clusters = {
    money   = { node_type = "cache.t4g.small", num_node_groups = 1, replicas_per_node_group = 1 }
    catalog = { node_type = "cache.t4g.small", num_node_groups = 1, replicas_per_node_group = 1 }
  }

  # ---- MSK (3 brokers minimum for multi-AZ quorum) ----
  kafka_version    = "3.6.0"
  msk_broker_count = 3

  # ---- S3 ----
  buckets = {
    assets  = { contains_personal_data = false }
    feeds   = { contains_personal_data = false }
    backups = { contains_personal_data = true } # personal => CRR blocked by module guard
  }

  # ---- Observability (managed Prometheus only in dev; no AMG) ----
  enable_managed_prometheus = true
  enable_managed_grafana    = false
}
