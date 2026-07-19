# Env: `dev`

> Single-region, scaled-down integration environment. Synthetic/anonymized data only. Auto-synced on merge to `main` ([10 §3]).

| Field | Value |
|-------|-------|
| **Purpose** | Fast shared integration tier — one `region-stack` in `us-east-1`, smaller node pools, single egress cell, no deletion protection. |
| **Region(s)** | `us-east-1` only. |
| **Data** | Synthetic + anonymized samples — **never production PII** ([10 data-handling hard rule]). |
| **Promotion** | Auto-sync on merge; CI green + smoke gates ([10 §3]). |
| **Maps to** | [10 §1 environments](../../../../docs/10-deployment-architecture.md#1-environments), [09 §12 footprint](../../../../docs/09-cloud-architecture.md#12-environments-footprint). |

## Composition

One `module "primary"` (region-stack). The discovery/money node-pool split and money/catalog Redis isolation are **kept even in dev** so scheduling and topology predict prod; sizes are minimized for cost.

## Deploy

```bash
cd infrastructure/terraform/envs/dev
cp terraform.tfvars.example terraform.tfvars      # optional overrides
# fill backend.tf bucket/table/kms from the global stack outputs, then:
terraform init
terraform plan      # review
terraform apply     # dev is auto-applied by CI on merge to main
```

## Notes / deviations from prod

- **Single egress cell** (`egress_cell_count = 1`) and **flow logs off** — cost-capped, not HA. Prod uses one cell per AZ.
- **`endpoint_public_access = true`** for laptop access — **must** be narrowed via `public_access_cidrs` (never `0.0.0.0/0`); prod is private.
- **`db_deletion_protection = false`**, backups 7d — dev data is disposable.
- `backups` bucket is marked `contains_personal_data = true` to demonstrate the CRR residency guard (replication is refused for it).

## Outputs

`cluster_name`, `cluster_endpoint`, `oidc_provider_arn`, `egress_cell_public_ips`, `db_writer_endpoint`, `redis_primary_endpoints` — consumed by the ArgoCD/Helm bootstrap.
