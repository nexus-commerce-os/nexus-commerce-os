# =============================================================================
# prod env — composition (Phase-1 US residency pair)
#   - primary   us-east-1  (US residency, live)
#   - dr        us-west-2  (in-zone DR pair, SAME residency zone — ADR-0016 R-013)
# Full HA: one egress cell per AZ, flow logs on, deletion protection on, multi-AZ
# data. Prod apply is MANUAL-APPROVAL only (see README + [10 §3/§11]).
#
# Adding EU / South-Asia / etc. is a new region-stack instantiation with its own
# in-zone DR pair, gated by the region-before-market gate ([09 §6], R-014).
# =============================================================================

locals {
  owner = var.owner_tag

  kms_keys = {
    eks     = { description = "prod EKS secrets" }
    rds     = { description = "prod Aurora" }
    redis   = { description = "prod Redis" }
    msk     = { description = "prod MSK" }
    s3      = { description = "prod S3" }
    secrets = { description = "prod Secrets Manager" }
  }

  cluster_version = "1.30"

  cluster_addons = {
    vpc-cni            = { version = "v1.18.1-eksbuild.3" }
    coredns            = { version = "v1.11.1-eksbuild.9" }
    kube-proxy         = { version = "v1.30.0-eksbuild.3" }
    aws-ebs-csi-driver = { version = "v1.31.0-eksbuild.1" }
  }

  node_pools = {
    money = {
      instance_types = ["m7g.large"]
      desired_size   = 3
      min_size       = 3
      max_size       = 12
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "money" }
      taints         = [{ key = "pool", value = "money", effect = "NO_SCHEDULE" }]
    }
    discovery = {
      instance_types = ["c7g.xlarge"]
      desired_size   = 4
      min_size       = 3
      max_size       = 40
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "discovery" }
    }
    gpu-warm = {
      instance_types = ["g5.xlarge"]
      ami_type       = "AL2023_x86_64_NVIDIA"
      desired_size   = 2
      min_size       = 2 # warm floor (interactive first-token SLO — R-078)
      max_size       = 8
      labels         = { pool = "gpu", workload = "inference" }
      taints         = [{ key = "nvidia.com/gpu", value = "true", effect = "NO_SCHEDULE" }]
    }
    ingest = {
      instance_types = ["m7g.large"]
      capacity_type  = "SPOT"
      desired_size   = 0
      min_size       = 0
      max_size       = 40
      ami_type       = "AL2023_ARM_64_STANDARD"
      labels         = { pool = "ingest" }
    }
  }

  db_engine_version = "16.4"
  db_instances = {
    writer   = { instance_class = "db.r7g.xlarge", promotion_tier = 0 }
    reader-1 = { instance_class = "db.r7g.xlarge", promotion_tier = 1 }
    reader-2 = { instance_class = "db.r7g.xlarge", promotion_tier = 2 }
  }

  redis_clusters = {
    money   = { node_type = "cache.r7g.large", num_node_groups = 1, replicas_per_node_group = 2 }
    catalog = { node_type = "cache.r7g.xlarge", num_node_groups = 3, replicas_per_node_group = 1 }
  }

  kafka_version    = "3.6.0"
  msk_broker_count = 3

  buckets = {
    assets  = { contains_personal_data = false }
    feeds   = { contains_personal_data = false, lifecycle_rules = [{ id = "expire-raw-feeds", prefix = "raw/", expiration_days = 30 }] }
    backups = { contains_personal_data = true } # residency: never cross-region
  }
}

# ------------------------------------------------------------------ Primary (us-east-1, live)
module "primary" {
  source = "../../modules/region-stack"

  name_prefix        = "nexus-prod-use1"
  tags               = { env = "prod", owner = local.owner, service = "platform", residency = "us" }
  vpc_cidr           = "10.30.0.0/16"
  availability_zones = slice(data.aws_availability_zones.primary.names, 0, 3)

  egress_cell_count = 0 # one cell per AZ (HA)
  enable_flow_logs  = true

  kms_keys        = local.kms_keys
  cluster_version = local.cluster_version
  cluster_addons  = local.cluster_addons
  node_pools      = local.node_pools

  # Prod EKS API is PRIVATE (no public endpoint).
  endpoint_public_access = false

  db_engine_version        = local.db_engine_version
  db_instances             = local.db_instances
  db_backup_retention_days = 30
  db_deletion_protection   = true

  redis_engine_version = "7.1"
  redis_clusters       = local.redis_clusters

  kafka_version    = local.kafka_version
  msk_broker_count = local.msk_broker_count

  buckets = local.buckets

  enable_managed_prometheus = true
  enable_managed_grafana    = true
}

# ------------------------------------------------------------------ In-zone DR pair (us-west-2)
module "dr" {
  source = "../../modules/region-stack"
  providers = {
    aws = aws.dr
  }

  name_prefix        = "nexus-prod-usw2"
  tags               = { env = "prod", owner = local.owner, service = "platform", residency = "us", role = "in-zone-dr" }
  vpc_cidr           = "10.31.0.0/16"
  availability_zones = slice(data.aws_availability_zones.dr.names, 0, 3)

  egress_cell_count = 0
  enable_flow_logs  = true

  kms_keys        = local.kms_keys
  cluster_version = local.cluster_version
  cluster_addons  = local.cluster_addons
  node_pools      = local.node_pools

  endpoint_public_access = false

  db_engine_version        = local.db_engine_version
  db_instances             = local.db_instances
  db_backup_retention_days = 30
  db_deletion_protection   = true

  redis_engine_version = "7.1"
  redis_clusters       = local.redis_clusters

  kafka_version    = local.kafka_version
  msk_broker_count = local.msk_broker_count

  buckets = local.buckets

  enable_managed_prometheus = true
  enable_managed_grafana    = false
}
