# =============================================================================
# staging env — composition (prod-identical, multi-region)
# Three region-stacks from the SAME module => staging == prod by construction:
#   - primary        us-east-1  (mirrors prod primary)
#   - regulated      ap-south-1 (Mumbai, South-Asia residency tier)
#   - regulated_dr   ap-south-2 (Hyderabad, in-zone DR pair)
# Exercising the regulated tier + its in-zone DR here validates residency and
# DR failover BEFORE the P4 market opens ([09 §12], ADR-0016 R-014/R-013).
# Data is masked/synthetic-at-scale ([10 data handling]).
# =============================================================================

locals {
  owner = var.owner_tag

  # ---- shared, prod-shaped config reused across all three regions ----
  kms_keys = {
    eks     = { description = "staging EKS secrets" }
    rds     = { description = "staging Aurora" }
    redis   = { description = "staging Redis" }
    msk     = { description = "staging MSK" }
    s3      = { description = "staging S3" }
    secrets = { description = "staging Secrets Manager" }
  }

  cluster_version = "1.30"

  cluster_addons = {
    vpc-cni            = { version = "v1.18.1-eksbuild.3" }
    coredns            = { version = "v1.11.1-eksbuild.9" }
    kube-proxy         = { version = "v1.30.0-eksbuild.3" }
    aws-ebs-csi-driver = { version = "v1.31.0-eksbuild.1" }
  }

  # Full discovery/money/gpu-warm/spot split (ADR-0017 R-059/R-078).
  node_pools = {
    money = {
      instance_types = ["m7g.large"]
      desired_size   = 3
      min_size       = 3
      max_size       = 9
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "money" }
      taints         = [{ key = "pool", value = "money", effect = "NO_SCHEDULE" }]
    }
    discovery = {
      instance_types = ["c7g.xlarge"]
      desired_size   = 3
      min_size       = 2
      max_size       = 20
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "discovery" }
    }
    gpu-warm = {
      instance_types = ["g5.xlarge"]
      ami_type       = "AL2023_x86_64_NVIDIA"
      desired_size   = 1
      min_size       = 1 # warm floor: never scale to zero (interactive first-token SLO)
      max_size       = 4
      labels         = { pool = "gpu", workload = "inference" }
      taints         = [{ key = "nvidia.com/gpu", value = "true", effect = "NO_SCHEDULE" }]
    }
    ingest = {
      instance_types = ["m7g.large"]
      capacity_type  = "SPOT"
      desired_size   = 0
      min_size       = 0
      max_size       = 20
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "ingest" }
    }
  }

  db_engine_version = "16.4"
  db_instances = {
    writer   = { instance_class = "db.r7g.large", promotion_tier = 0 }
    reader-1 = { instance_class = "db.r7g.large", promotion_tier = 1 }
  }

  redis_clusters = {
    money   = { node_type = "cache.r7g.large", num_node_groups = 1, replicas_per_node_group = 2 }
    catalog = { node_type = "cache.r7g.large", num_node_groups = 2, replicas_per_node_group = 1 }
  }

  kafka_version    = "3.6.0"
  msk_broker_count = 3

  buckets = {
    assets  = { contains_personal_data = false }
    feeds   = { contains_personal_data = false }
    backups = { contains_personal_data = true } # residency: never replicated cross-region
  }
}

# ------------------------------------------------------------------ Primary (US)
module "primary" {
  source = "../../modules/region-stack"

  name_prefix        = "nexus-staging-use1"
  tags               = { env = "staging", owner = local.owner, service = "platform", residency = "us" }
  vpc_cidr           = "10.20.0.0/16"
  availability_zones = slice(data.aws_availability_zones.primary.names, 0, 3)

  kms_keys        = local.kms_keys
  cluster_version = local.cluster_version
  cluster_addons  = local.cluster_addons
  node_pools      = local.node_pools

  db_engine_version = local.db_engine_version
  db_instances      = local.db_instances

  redis_engine_version = "7.1"
  redis_clusters       = local.redis_clusters

  kafka_version    = local.kafka_version
  msk_broker_count = local.msk_broker_count

  buckets = local.buckets

  enable_managed_prometheus = true
  enable_managed_grafana    = true
}

# ------------------------------------------------------------------ Regulated tier (ap-south-1)
module "regulated" {
  source = "../../modules/region-stack"
  providers = {
    aws = aws.regulated
  }

  name_prefix        = "nexus-staging-aps1"
  tags               = { env = "staging", owner = local.owner, service = "platform", residency = "south-asia" }
  vpc_cidr           = "10.21.0.0/16"
  availability_zones = slice(data.aws_availability_zones.regulated.names, 0, 3)

  kms_keys        = local.kms_keys
  cluster_version = local.cluster_version
  cluster_addons  = local.cluster_addons
  node_pools      = local.node_pools

  db_engine_version = local.db_engine_version
  db_instances      = local.db_instances

  redis_engine_version = "7.1"
  redis_clusters       = local.redis_clusters

  kafka_version    = local.kafka_version
  msk_broker_count = local.msk_broker_count

  buckets = local.buckets

  enable_managed_prometheus = true
  enable_managed_grafana    = false
}

# ------------------------------------------------------------------ In-zone DR pair (ap-south-2)
module "regulated_dr" {
  source = "../../modules/region-stack"
  providers = {
    aws = aws.regulated_dr
  }

  name_prefix        = "nexus-staging-aps2"
  tags               = { env = "staging", owner = local.owner, service = "platform", residency = "south-asia", role = "in-zone-dr" }
  vpc_cidr           = "10.22.0.0/16"
  availability_zones = slice(data.aws_availability_zones.regulated_dr.names, 0, 3)

  kms_keys        = local.kms_keys
  cluster_version = local.cluster_version
  cluster_addons  = local.cluster_addons
  node_pools      = local.node_pools

  db_engine_version = local.db_engine_version
  db_instances      = local.db_instances

  redis_engine_version = "7.1"
  redis_clusters       = local.redis_clusters

  kafka_version    = local.kafka_version
  msk_broker_count = local.msk_broker_count

  buckets = local.buckets

  enable_managed_prometheus = true
  enable_managed_grafana    = false
}
