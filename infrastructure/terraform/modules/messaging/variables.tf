# =============================================================================
# messaging module (MSK — Apache Kafka) — inputs
# The event backbone / CQRS projection + feed-ingestion spine ([09 §5/§6]).
# Genuine Apache Kafka (ADR-0003: MSK, not a Kafka-API shim), so Confluent /
# self-host / Redpanda stay drop-in exits.
# =============================================================================

variable "name_prefix" {
  description = "Prefix for the MSK cluster name, e.g. \"nexus-prod-use1\"."
  type        = string
}

variable "kafka_version" {
  description = "Apache Kafka version (e.g. \"3.6.0\"). Standard protocol only."
  type        = string
}

variable "vpc_id" {
  description = "VPC id (from network) for the broker security group."
  type        = string
}

variable "data_subnet_ids" {
  description = "Private-data subnet ids (from network). Broker count MUST be a multiple of the AZ count for balanced placement."
  type        = list(string)
}

variable "broker_count" {
  description = "Total number of broker nodes. MUST be a multiple of len(data_subnet_ids) and >= that length (>=3 for multi-AZ)."
  type        = number

  validation {
    condition     = var.broker_count >= 3
    error_message = "Provision >= 3 brokers for multi-AZ quorum."
  }
}

variable "broker_instance_type" {
  description = "Broker instance type (e.g. \"kafka.m7g.large\" — Graviton where possible)."
  type        = string
  default     = "kafka.m7g.large"
}

variable "broker_ebs_volume_size" {
  description = "Per-broker EBS storage (GiB). Right-sized to retention/throughput ([09 §9])."
  type        = number
  default     = 100
}

variable "allowed_security_group_ids" {
  description = "App-tier SG ids permitted to reach the brokers (TLS 9094). SG-reference, not CIDR."
  type        = list(string)
  default     = []
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key ARN (from security) for at-rest encryption."
  type        = string
}

variable "config_overrides" {
  description = "Server.properties overrides (e.g. auto.create.topics.enable=false, min.insync.replicas=2). Keep to standard Kafka settings for portability."
  type        = map(string)
  default = {
    "auto.create.topics.enable"  = "false"
    "default.replication.factor" = "3"
    "min.insync.replicas"        = "2"
  }
}

variable "enhanced_monitoring" {
  description = "MSK monitoring level (DEFAULT | PER_BROKER | PER_TOPIC_PER_BROKER | PER_TOPIC_PER_PARTITION). Prometheus JMX/Node exporters are enabled separately ([09 §11])."
  type        = string
  default     = "PER_TOPIC_PER_BROKER"
}

variable "log_group_name" {
  description = "CloudWatch log group name for broker logs. Empty disables broker log delivery."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Mandatory cost + ownership tags. Untagged => SCP deny."
  type        = map(string)
}
