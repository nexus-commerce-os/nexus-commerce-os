# =============================================================================
# cache module (ElastiCache Redis/Valkey) — main
# Realizes [09 §5] Redis + ADR-0017 R-082 isolation:
#   - A MAP of clusters, each cluster-mode, multi-AZ, encrypted at rest+transit.
#   - The money/auth cluster and the catalog-invalidation cluster are separate
#     replication groups (own failure domains) — a catalog stampede cannot evict
#     session/auth/rate-limit state.
#   - OSS Redis/Valkey API only (portability caveat, [09 §5]).
#
# AUTH: transit encryption is always on; per-user AUTH is provisioned via
# ElastiCache RBAC users OR a rotated AUTH token supplied out-of-band — this
# module never authors a token, so none enters state/Git ([09 §10]).
# =============================================================================

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-redis"
  subnet_ids = var.data_subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "this" {
  name_prefix = "${var.name_prefix}-redis-"
  description = "ElastiCache Redis. Ingress 6379 from app SGs only; no CIDR; no internet egress."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "redis" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  description                  = "Redis from app tier SG ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  referenced_security_group_id = each.value
}

# One replication group per map entry. Two entries (money, catalog) => two
# isolated failure domains (ADR-0017 R-082).
resource "aws_elasticache_replication_group" "this" {
  for_each = var.clusters

  replication_group_id = "${var.name_prefix}-${each.key}"
  description          = "NEXUS ${each.key} Redis (${var.name_prefix}) — isolated per ADR-0017 R-082"

  engine         = "redis"
  engine_version = var.engine_version
  node_type      = each.value.node_type
  port           = 6379

  # Cluster mode: shards x replicas, multi-AZ with automatic failover.
  num_node_groups            = each.value.num_node_groups
  replicas_per_node_group    = each.value.replicas_per_node_group
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  # Encryption everywhere (NFR-SEC-01).
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  transit_encryption_enabled = true

  snapshot_retention_limit = each.value.snapshot_retention
  snapshot_window          = "02:00-03:00"
  maintenance_window       = "sun:03:30-sun:04:30"

  apply_immediately = false

  tags = merge(var.tags, {
    Name    = "${var.name_prefix}-${each.key}"
    Purpose = each.key
  })

  lifecycle {
    prevent_destroy = true
  }
}
