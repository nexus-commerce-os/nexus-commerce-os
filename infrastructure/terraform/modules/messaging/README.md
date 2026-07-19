# Module: `messaging`

> MSK (genuine Apache Kafka) — the event backbone, CQRS projection spine, and feed-ingestion pipeline.

| Field | Value |
|-------|-------|
| **Purpose** | Provision a multi-AZ MSK cluster with TLS + at-rest encryption and IAM SASL auth, plus Prometheus exporters for observability. This is the event backbone and the cross-region projection replication source. |
| **Owner** | Data Platform (`infra-data`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — per region. Cross-region MirrorMaker2/MSK-Replicator (non-personal projections only) is composed at env level. |
| **Maps to** | [09 §5 data services](../../../../docs/09-cloud-architecture.md#5-managed-data-services-mapping), [09 §6 replication](../../../../docs/09-cloud-architecture.md#6-multi-region-strategy), [09 §7 KEDA lag scaling](../../../../docs/09-cloud-architecture.md#7-scalability--elasticity); **ADR-0003** (MSK, not a Kafka shim); **ADR-0016 R-013** (replication scope = in-zone / non-personal only). |

## What it creates

- **`aws_msk_cluster`** — `broker_count` nodes across the data subnets; EBS storage per broker; **encryption in transit (TLS) + at rest (CMK)**; **IAM SASL** client auth (no static Kafka creds); enhanced monitoring + JMX/Node **Prometheus exporters**; optional CloudWatch broker logs; `prevent_destroy`.
- **`aws_msk_configuration`** — server.properties from `config_overrides` (defaults: `auto.create.topics.enable=false`, `replication.factor=3`, `min.insync.replicas=2`).
- **Security group** — ingress `9094` (TLS) + `9098` (IAM SASL) from referenced app SGs only.

## Portability & residency

MSK speaks the **standard Kafka protocol**, so Confluent / self-hosted / Redpanda remain drop-in exits (ADR-0003). Cross-region replication carries **catalog/offer/price projections only** — personal/ledger topics are excluded from cross-region/cross-residency mirrors (ADR-0016 R-013); the "RPO≈0" guarantee is scoped to the **in-zone DR pair**, never cross-residency.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `kafka_version`, `vpc_id` + `data_subnet_ids` (from `network`), `broker_count` (≥3, multi-AZ), `broker_instance_type`, `kms_key_arn` (from `security`), `allowed_security_group_ids`, `config_overrides`.

**Outputs:** `cluster_arn`, `bootstrap_brokers_tls`, `bootstrap_brokers_sasl_iam` (preferred), `security_group_id`, `configuration_arn`.

## Dependencies

- **Upstream:** `network`, `security` (KMS), app SGs.
- **Downstream:** feed-ingestion consumers (KEDA scales on **Kafka lag**, [09 §7]), CQRS projectors (OpenSearch/ClickHouse/Postgres), cross-region replicator.

## Security notes

- TLS in transit, CMK at rest (NFR-SEC-01); **IAM SASL** means pod IRSA roles authorize Kafka access — no shared passwords.
- Internet-isolated (data tier); SG-reference ingress only.
- `min.insync.replicas=2` + RF=3 for durability; `prevent_destroy` guards the backbone.

## How to test in isolation

```bash
terraform -chdir=modules/messaging init -backend=false
terraform -chdir=modules/messaging validate
```
