# Module: `database`

> Multi-AZ Aurora PostgreSQL cluster — the OLTP / ledger / catalog-projection system of record, portable-Postgres-only.

| Field | Value |
|-------|-------|
| **Purpose** | Provision a KMS-encrypted, multi-AZ Aurora PostgreSQL cluster with PITR, a Secrets-Manager-managed master credential, and SG-reference-only ingress from the app tier. |
| **Owner** | Data Platform (`infra-data`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — the home-region cluster + (in staging/prod) a second instantiation in the **in-zone DR-pair** region. |
| **Maps to** | [09 §5 data services](../../../../docs/09-cloud-architecture.md#5-managed-data-services-mapping), [09 §6 multi-region](../../../../docs/09-cloud-architecture.md#6-multi-region-strategy), [09 §8 reliability](../../../../docs/09-cloud-architecture.md#8-reliability); **ADR-0003** (portability caveat: standard Postgres only); **ADR-0016 R-013/R-036** (in-zone DR pair, DR proven on the portable path). |

## What it creates

- **`aws_rds_cluster`** (aurora-postgresql) — `storage_encrypted` with a CMK, PITR via `backup_retention_period ≥ 7`, audit log export, `deletion_protection`, **`prevent_destroy`**, final snapshot on destroy.
- **`aws_rds_cluster_instance`** (`for_each`) — writer + reader(s) across AZs; `promotion_tier` sets failover preference; Performance Insights on.
- **`aws_db_subnet_group`** — pinned to the **private-data** subnets (internet-isolated).
- **Security group** — ingress `5432` **only** from referenced app SGs (`aws_vpc_security_group_ingress_rule` with `referenced_security_group_id`); no CIDR ingress; no internet egress.
- **Cluster parameter group** — overrides constrained to **standard** Postgres params.

## The no-secret-in-Git property

`manage_master_user_password = true` means **AWS generates, stores, and rotates** the master password in Secrets Manager (encrypted with the CMK). This module never authors a password, so none can land in state or Git ([09 §10]). Workloads read it via the **External Secrets Operator** using the emitted `master_user_secret_arn`.

## The portability property

Only standard PostgreSQL features/params are used — no Aurora-proprietary extensions. That is what keeps the **plain-Postgres-on-K8s / Cloud SQL exit** a migration, not a rewrite (ADR-0003), and lets DR RTO/RPO be validated on the portable path (ADR-0016 R-036). The CI portability gate flags Aurora-only feature creep.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `engine_version`, `data_subnet_ids` + `vpc_id` (from `network`), `allowed_security_group_ids` (app SGs), `instances` (map), `kms_key_arn` (from `security`), `backup_retention_days`, `deletion_protection`.

**Outputs:** `cluster_arn`, `writer_endpoint`, `reader_endpoint`, `port`, `database_name`, `master_user_secret_arn` (→ ESO), `security_group_id`.

## Dependencies

- **Upstream:** `network` (data subnets, VPC id), `security` (KMS key), `compute`/app SGs (ingress references).
- **Downstream:** application services (via ESO-injected connection secret); `monitoring` (Performance Insights / logs).

## Security notes

- **At-rest encryption** with a customer-managed KMS key (NFR-SEC-01); **in-transit** TLS enforced at the app connection layer.
- **Internet-isolated** by placement in the data tier (no NAT route).
- **SG-reference ingress only** — no `0.0.0.0/0`, no CIDR trust.
- **`prevent_destroy` + `deletion_protection`** — destructive rollback is blocked by design; schema rollback follows expand→contract ([10 §4.1]).

## How to test in isolation

```bash
terraform -chdir=modules/database init -backend=false
terraform -chdir=modules/database validate
```
