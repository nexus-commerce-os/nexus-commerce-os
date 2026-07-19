# Module: `cache`

> Isolated ElastiCache Redis clusters — money/auth state and catalog-invalidation cache are separate failure domains.

| Field | Value |
|-------|-------|
| **Purpose** | Provision one hardened, cluster-mode, multi-AZ Redis replication group **per purpose**. The canonical two are `money` (sessions/auth/rate-limit) and `catalog` (high-churn invalidation) — kept apart so a catalog stampede can't evict auth state. |
| **Owner** | Data Platform (`infra-data`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — per region. |
| **Maps to** | [09 §5 data services](../../../../docs/09-cloud-architecture.md#5-managed-data-services-mapping); **ADR-0017 R-082** (money/catalog Redis isolation); **ADR-0003** (OSS Redis/Valkey API only). |

## What it creates

- **`aws_elasticache_replication_group`** (`for_each` over `var.clusters`) — cluster mode (`num_node_groups` shards × `replicas_per_node_group`), `automatic_failover_enabled`, `multi_az_enabled`, at-rest KMS + transit encryption, snapshots, `prevent_destroy`.
- **`aws_elasticache_subnet_group`** — private-data subnets.
- **Security group** — ingress `6379` from referenced app SGs only.

## The isolation property (ADR-0017 R-082)

The blast-radius split is expressed as **two map entries**, each becoming an independent replication group with its own nodes and failover. Example:

```hcl
clusters = {
  money   = { node_type="cache.r7g.large", num_node_groups=1, replicas_per_node_group=2 }
  catalog = { node_type="cache.r7g.xlarge", num_node_groups=3, replicas_per_node_group=1 }
}
```

Because they are distinct replication groups, a catalog cache stampede (eviction storm on `catalog`) cannot touch the `money` cluster holding session/auth/rate-limit state.

## AUTH / no-secret-in-Git

Transit encryption is always on. Per-user AUTH is provisioned via **ElastiCache RBAC users** or a **rotated AUTH token supplied out-of-band** (Secrets Manager + ESO). This module never authors a token, so none enters state or Git ([09 §10]).

## Inputs / Outputs

**Key inputs:** `name_prefix`, `vpc_id` + `data_subnet_ids` (from `network`), `allowed_security_group_ids`, `kms_key_arn` (from `security`), `clusters` (map), `engine_version`.

**Outputs:** `primary_endpoints` (map by purpose), `reader_endpoints`, `replication_group_ids`, `security_group_id`.

## Dependencies

- **Upstream:** `network`, `security` (KMS), app SGs.
- **Downstream:** application services (ESO-injected endpoints/token).

## Security notes

- At-rest (CMK) + in-transit encryption on every cluster (NFR-SEC-01).
- Internet-isolated (data tier); SG-reference ingress only.
- `prevent_destroy` guards accidental teardown; the money cluster is the protected one.

## How to test in isolation

```bash
terraform -chdir=modules/cache init -backend=false
terraform -chdir=modules/cache validate
```
