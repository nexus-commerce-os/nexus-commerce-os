# =============================================================================
# region-stack (composition) — main
# Wires the 8 primitives into one self-similar region ([09 §2]: "every region is
# structurally identical"). Dependency order is explicit and acyclic:
#
#   security_keys (KMS+secrets)  ->  compute (EKS, uses eks KMS key)
#                                        |
#                                        v
#   network (VPC/subnets/egress)     security_irsa (IRSA roles, uses EKS OIDC)
#            |                                 |
#            +-----> database / cache / messaging / storage (data tier + KMS)
#                                        |
#                                        v
#                                   monitoring (collector IRSA)
#
# The security module is instantiated TWICE (keys first, then IRSA roles) to
# break the compute<->security cycle cleanly — KMS keys have no OIDC dependency;
# IRSA roles need the cluster OIDC that only exists after compute.
# =============================================================================

# ---- KMS keys + secret containers (no OIDC dependency) ----
module "security_keys" {
  source = "../security"

  name_prefix = var.name_prefix
  kms_keys    = var.kms_keys
  secrets     = var.secrets
  tags        = var.tags
}

# ---- Network fabric ----
module "network" {
  source = "../network"

  name_prefix                 = var.name_prefix
  vpc_cidr                    = var.vpc_cidr
  availability_zones          = var.availability_zones
  egress_cell_count           = var.egress_cell_count
  interface_endpoint_services = var.interface_endpoint_services
  enable_flow_logs            = var.enable_flow_logs
  tags                        = var.tags
}

# ---- Compute (EKS) — uses the eks KMS key for secret envelope encryption ----
module "compute" {
  source = "../compute"

  name_prefix                    = var.name_prefix
  cluster_version                = var.cluster_version
  app_subnet_ids                 = module.network.app_subnet_ids_list
  endpoint_public_access         = var.endpoint_public_access
  public_access_cidrs            = var.public_access_cidrs
  cluster_encryption_kms_key_arn = try(module.security_keys.kms_key_arns["eks"], "")
  node_pools                     = var.node_pools
  cluster_addons                 = var.cluster_addons
  tags                           = var.tags
}

# ---- IRSA roles — need the cluster OIDC provider from compute ----
module "security_irsa" {
  source = "../security"

  name_prefix       = "${var.name_prefix}-irsa"
  kms_keys          = {}
  secrets           = {}
  oidc_provider_arn = module.compute.oidc_provider_arn
  oidc_provider_url = module.compute.oidc_provider_url
  irsa_roles        = var.irsa_roles
  tags              = var.tags
}

# ---- Data tier — all reached from the EKS primary SG (app->data by SG ref) ----
module "database" {
  source = "../database"

  name_prefix                = var.name_prefix
  engine_version             = var.db_engine_version
  data_subnet_ids            = module.network.data_subnet_ids_list
  vpc_id                     = module.network.vpc_id
  allowed_security_group_ids = [module.compute.cluster_primary_security_group_id]
  instances                  = var.db_instances
  kms_key_arn                = module.security_keys.kms_key_arns["rds"]
  backup_retention_days      = var.db_backup_retention_days
  deletion_protection        = var.db_deletion_protection
  tags                       = var.tags
}

module "cache" {
  source = "../cache"

  name_prefix                = var.name_prefix
  vpc_id                     = module.network.vpc_id
  data_subnet_ids            = module.network.data_subnet_ids_list
  allowed_security_group_ids = [module.compute.cluster_primary_security_group_id]
  kms_key_arn                = module.security_keys.kms_key_arns["redis"]
  engine_version             = var.redis_engine_version
  clusters                   = var.redis_clusters
  tags                       = var.tags
}

module "messaging" {
  source = "../messaging"

  name_prefix                = var.name_prefix
  kafka_version              = var.kafka_version
  vpc_id                     = module.network.vpc_id
  data_subnet_ids            = module.network.data_subnet_ids_list
  broker_count               = var.msk_broker_count
  broker_instance_type       = var.msk_broker_instance_type
  broker_ebs_volume_size     = var.msk_broker_ebs_volume_size
  allowed_security_group_ids = [module.compute.cluster_primary_security_group_id]
  kms_key_arn                = module.security_keys.kms_key_arns["msk"]
  tags                       = var.tags
}

module "storage" {
  source = "../storage"

  name_prefix          = var.name_prefix
  kms_key_arn          = module.security_keys.kms_key_arns["s3"]
  buckets              = var.buckets
  replication          = var.bucket_replication
  replication_role_arn = var.replication_role_arn
  tags                 = var.tags
}

# ---- Observability (separate failure domain; collector IRSA on cluster OIDC) ----
module "monitoring" {
  source = "../monitoring"

  name_prefix               = var.name_prefix
  enable_managed_prometheus = var.enable_managed_prometheus
  enable_managed_grafana    = var.enable_managed_grafana
  oidc_provider_arn         = module.compute.oidc_provider_arn
  oidc_provider_url         = module.compute.oidc_provider_url
  tags                      = var.tags
}
