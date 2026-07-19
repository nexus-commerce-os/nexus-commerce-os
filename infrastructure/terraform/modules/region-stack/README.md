# Module: `region-stack` (composition)

> "The identical Terraform region module" — wires the 8 primitives into one self-similar region so envs are thin and staging ≡ prod by construction.

| Field | Value |
|-------|-------|
| **Purpose** | Compose `network + compute + database + cache + messaging + storage + security + monitoring` into a single, structurally-identical region. An environment stands up a region (or a DR-pair region) by instantiating this **once** with a provider alias. |
| **Owner** | Platform / Cloud (`infra-platform`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — dev ×1, staging ×2 (us-east-1 + **ap-south-1** regulated tier), prod ×2 (primary + **in-zone DR pair**). |
| **Maps to** | [09 §2 self-similar regions](../../../../docs/09-cloud-architecture.md#2-high-level-cloud-topology), [09 §6 "identical region module + DR pair"](../../../../docs/09-cloud-architecture.md#6-multi-region-strategy), [10 §5 "environments are thin compositions"](../../../../docs/10-deployment-architecture.md#5-infrastructure-as-code-iac); **ADR-0016** (region-before-market, in-zone DR); **ADR-0017** (all isolation splits). |

## Why a composition module (and why the 8 stay separate)

The certified docs repeatedly call for "**instantiating the identical Terraform region module (with its in-zone DR pair)**". This module is that unit. The 8 primitives remain **independently `terraform validate`-able** building blocks with no cross-module coupling; `region-stack` is the *only* place they are wired together, and envs never wire primitives directly. That is what makes "staging is prod-identical" a **construction guarantee**, not a review checklist.

## Dependency ordering (acyclic)

`security` is instantiated **twice** to break the compute↔security cycle:

1. `security_keys` — KMS keys + secret containers (no OIDC needed).
2. `network` — VPC/subnets/egress cells.
3. `compute` — EKS, using the `eks` KMS key for secret envelope encryption.
4. `security_irsa` — IRSA roles, using the cluster OIDC from `compute`.
5. `database` / `cache` / `messaging` / `storage` — data tier, each with its domain KMS key, ingress from the EKS **primary** SG (app→data by SG-reference).
6. `monitoring` — collector IRSA on the cluster OIDC; separate failure domain.

## Required KMS key names

`var.kms_keys` **must** contain keys named `eks`, `rds`, `redis`, `msk`, `s3` (and any referenced by `secrets`), because the wiring looks them up by purpose.

## Inputs / Outputs

Inputs are the union of the 8 modules' knobs, grouped by prefix (`db_*`, `redis_*`, `msk_*`, etc.). See `variables.tf`. Outputs surface everything an env or the GitOps/Helm bootstrap needs: `cluster_endpoint`, `oidc_provider_arn`, `kms_key_arns`, `irsa_role_arns`, `db_*`, `redis_primary_endpoints`, `kafka_bootstrap_brokers_sasl_iam`, `bucket_arns`, `egress_cell_public_ips`, `prometheus_remote_write_endpoint`.

## Dependencies

- **Upstream:** `global` (state backend, deploy roles) at the estate level; a configured AWS provider (region) passed by the env.
- **Downstream:** ArgoCD/Helm bootstrap (cluster + endpoints), cross-region DR/CRR wiring (peer region's outputs).

## Security notes

Inherits every child module's posture: private-by-default networking, internet-isolated data tier, per-domain KMS, IRSA-only pod identity, no secret values in state. Adds nothing that weakens them — it only wires outputs to inputs.

## How to validate

```bash
terraform -chdir=modules/region-stack init -backend=false
terraform -chdir=modules/region-stack validate
```
