# =============================================================================
# messaging module (MSK — Apache Kafka) — main
# Realizes [09 §5] Kafka backbone + [09 §6] the CQRS/projection replication spine:
#   - Genuine Apache Kafka on MSK (ADR-0003), multi-AZ brokers in the data tier.
#   - Encryption in transit (TLS) + at rest (CMK); IAM SASL auth.
#   - Prometheus JMX/Node exporters on for the observability stack ([09 §11]).
# Cross-region replication (MirrorMaker2 / MSK Replicator) for NON-personal
# catalog/offer/price projections is wired at the ENV level, scoped to exclude
# personal/ledger data (ADR-0016 R-013 residency).
# =============================================================================

resource "aws_security_group" "this" {
  name_prefix = "${var.name_prefix}-msk-"
  description = "MSK brokers. Ingress TLS 9094 + IAM 9098 from app SGs only; no CIDR; no internet egress."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-msk-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "tls" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  description                  = "Kafka TLS from app SG ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = 9094
  to_port                      = 9094
  referenced_security_group_id = each.value
}

resource "aws_vpc_security_group_ingress_rule" "iam_sasl" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  description                  = "Kafka IAM SASL from app SG ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = 9098
  to_port                      = 9098
  referenced_security_group_id = each.value
}

resource "aws_msk_configuration" "this" {
  name              = "${var.name_prefix}-msk-config"
  kafka_versions    = [var.kafka_version]
  server_properties = join("\n", [for k, v in var.config_overrides : "${k}=${v}"])

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_msk_cluster" "this" {
  cluster_name           = var.name_prefix
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.broker_count

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.data_subnet_ids
    security_groups = [aws_security_group.this.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_ebs_volume_size
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  # In-transit + at-rest encryption (NFR-SEC-01).
  encryption_info {
    encryption_at_rest_kms_key_arn = var.kms_key_arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  # IAM-based SASL auth — no static Kafka credentials ([09 §10]).
  client_authentication {
    sasl {
      iam = true
    }
  }

  enhanced_monitoring = var.enhanced_monitoring

  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }

  dynamic "logging_info" {
    for_each = var.log_group_name == "" ? [] : [1]
    content {
      broker_logs {
        cloudwatch_logs {
          enabled   = true
          log_group = var.log_group_name
        }
      }
    }
  }

  tags = merge(var.tags, { Name = var.name_prefix })

  lifecycle {
    prevent_destroy = true
  }
}
