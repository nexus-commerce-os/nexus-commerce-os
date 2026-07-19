# =============================================================================
# database module (Aurora PostgreSQL) — main
# Realizes [09 §5] Postgres SoR:
#   - Multi-AZ Aurora cluster, KMS-encrypted at rest, PITR/backups on.
#   - Master password generated + held in Secrets Manager (never in state/Git).
#   - Reached only from the app tier via SG-reference, inside private-data subnets.
#   - STANDARD Postgres features only -> the plain-Postgres exit stays viable
#     (ADR-0003 portability caveat; DR proven on the portable path, ADR-0016 R-036).
# In-zone DR pair replication is composed at the ENV level (a second cluster in
# the DR-pair region), not hidden inside this module.
# =============================================================================

resource "aws_db_subnet_group" "this" {
  name_prefix = "${var.name_prefix}-aurora-"
  subnet_ids  = var.data_subnet_ids
  tags        = merge(var.tags, { Name = "${var.name_prefix}-aurora-subnets" })

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------ Security group (SG-reference ingress)
resource "aws_security_group" "this" {
  name_prefix = "${var.name_prefix}-aurora-"
  description = "Aurora Postgres. Ingress 5432 only from referenced app SGs; no CIDR ingress; no egress to internet."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-aurora-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  description                  = "Postgres from app tier SG ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = each.value
}

# ------------------------------------------------------------------ Parameter group (standard params only)
resource "aws_rds_cluster_parameter_group" "this" {
  name_prefix = "${var.name_prefix}-aurora-"
  family      = "aurora-postgresql${split(".", var.engine_version)[0]}"
  description = "Standard Postgres params for ${var.name_prefix} (portability-safe)."

  dynamic "parameter" {
    for_each = var.cluster_parameters
    content {
      name  = parameter.key
      value = parameter.value
    }
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------ Aurora cluster
resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.name_prefix}-aurora"
  engine             = "aurora-postgresql"
  engine_version     = var.engine_version
  database_name      = var.database_name

  master_username = var.master_username
  # AWS generates + rotates the master password into Secrets Manager. No secret
  # is authored here, so none can leak into state or Git ([09 §10] secrets).
  manage_master_user_password   = true
  master_user_secret_kms_key_id = var.kms_key_arn

  db_subnet_group_name            = aws_db_subnet_group.this.name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name
  vpc_security_group_ids          = [aws_security_group.this.id]

  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  backup_retention_period      = var.backup_retention_days
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:30-sun:05:30"
  copy_tags_to_snapshot        = true

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-aurora-final"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(var.tags, { Name = "${var.name_prefix}-aurora" })

  lifecycle {
    # Data store: destructive rollback is blocked; contract-step DDL is a
    # separate, later PR ([10 §4.1] expand->contract).
    prevent_destroy = true
    ignore_changes  = [master_username, final_snapshot_identifier]
  }
}

# ------------------------------------------------------------------ Cluster instances (multi-AZ HA)
resource "aws_rds_cluster_instance" "this" {
  for_each = var.instances

  identifier         = "${var.name_prefix}-${each.key}"
  cluster_identifier = aws_rds_cluster.this.id
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
  instance_class     = each.value.instance_class

  db_subnet_group_name = aws_db_subnet_group.this.name
  promotion_tier       = each.value.promotion_tier
  publicly_accessible  = each.value.publicly_accessible

  performance_insights_enabled    = var.performance_insights_enabled
  performance_insights_kms_key_id = var.performance_insights_enabled ? var.kms_key_arn : null

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-${each.key}"
    Role = each.value.promotion_tier == 0 ? "writer-preferred" : "reader"
  })
}
