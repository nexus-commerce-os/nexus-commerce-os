# Env: `staging`

> Prod-identical proving ground. **Includes the ap-south-1 regulated tier + its in-zone DR pair** so residency and DR are exercised before the P4 market opens.

| Field | Value |
|-------|-------|
| **Purpose** | The SLO / load / chaos / **DR & residency** proving ground. Topology-identical to prod; same `region-stack` module, prod-shaped sizing. |
| **Region(s)** | `us-east-1` (primary) + **`ap-south-1`** (regulated South-Asia tier) + **`ap-south-2`** (in-zone DR pair). |
| **Data** | Synthetic-at-scale + **masked** production shapes — never real PII ([10 data-handling]). |
| **Promotion** | Auto-sync of tagged release candidates; SLO/load/chaos/DR gates must pass before the prod approval gate ([10 §3]). |
| **Maps to** | [09 §12 staging carries the regulated-region tier](../../../../docs/09-cloud-architecture.md#12-environments-footprint), [10 §1 staging parity](../../../../docs/10-deployment-architecture.md#1-environments); **ADR-0016 R-014** (regulated tier before P4), **R-013** (in-zone DR pair). |

## Why three regions (the point of staging)

The certified architecture **requires** staging to be topology-identical to prod and to carry the regulated South-Asia tier + its in-zone DR pair, so residency fencing and in-zone DR failover are tested on the regulated region **before** the Phase-4 market opens — not first exercised in prod. All three regions are the **same `region-stack` module** with different `vpc_cidr` / AZs / provider alias, which is exactly what makes "staging ≡ prod by construction" true.

## Composition

- `module.primary` → `aws` (us-east-1)
- `module.regulated` → `aws.regulated` (ap-south-1)
- `module.regulated_dr` → `aws.regulated_dr` (ap-south-2)

Shared prod-shaped config (KMS set, node pools incl. GPU warm floor + spot, Aurora writer+reader, money/catalog Redis, MSK, buckets) lives in `locals` and is reused across all three so drift is impossible.

## Deploy

```bash
cd infrastructure/terraform/envs/staging
cp terraform.tfvars.example terraform.tfvars
# fill backend.tf from the global stack outputs, then:
terraform init
terraform plan
terraform apply    # CI auto-syncs tagged RCs; gates in [10 §3/§8]
```

## Outputs

`primary`, `regulated`, `regulated_dr` objects (cluster name/endpoint, OIDC ARN, DB writer, egress IPs) for the GitOps bootstrap and the residency/DR game-day tooling.
