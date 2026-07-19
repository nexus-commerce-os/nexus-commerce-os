# Module: `security`

> Cloud-plane security primitives: per-domain KMS keys, scoped IRSA roles, and Secrets Manager containers (no secret values ever authored).

| Field | Value |
|-------|-------|
| **Purpose** | Provision the encryption + identity plumbing every other module consumes: customer-managed KMS keys (one per data domain), IRSA roles that grant each pod a scoped IAM identity, and empty Secrets Manager containers whose values arrive via rotation/ESO. |
| **Owner** | Security Engineering (`infra-security`) — **policy** rules owned by [08 Security]; this module is the enforcement plumbing. |
| **Instantiated by** | `envs/{dev,staging,prod}` — per region. Depends on `compute` for the OIDC provider. |
| **Maps to** | [09 §10 cloud security posture](../../../../docs/09-cloud-architecture.md#10-cloud-security-posture); **ADR-0016 R-013** (multi-region keys only for non-personal data); portability control-plane note in **ADR-0003 §5 / ADR-0019 R-012** (IRSA behind an identity port). |

## What it creates

- **`aws_kms_key` + alias** (`for_each` over `var.kms_keys`) — rotation on by default, per-domain (rds/redis/msk/s3/eks/secrets) so a key compromise is contained. `multi_region = true` only for keys backing cross-region **non-personal** data.
- **IRSA roles** (`for_each` over `var.irsa_roles`) — each trust policy pins **exactly one** `system:serviceaccount:<ns>:<sa>` via the OIDC `sub` condition + `aud = sts.amazonaws.com`. No wildcards, no node-wide creds. Managed policy ARNs and least-privilege inline policies attach per role.
- **`aws_secretsmanager_secret`** containers (`for_each` over `var.secrets`) — **metadata only**. There is deliberately **no `aws_secretsmanager_secret_version`**, so no plaintext value can enter state or Git; values are written out-of-band by rotation Lambdas and read by the External Secrets Operator.

## The least-privilege property

IRSA is the core of [09 §10]: instead of granting the node role broad access, each workload's ServiceAccount assumes a narrow role. The trust condition here is exact-match on the SA identity — a pod in another namespace cannot assume the role even on the same cluster.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `kms_keys` (map), `oidc_provider_arn` + `oidc_provider_url` (from `compute`), `irsa_roles` (map), `secrets` (map).

**Outputs:** `kms_key_arns` + `kms_key_ids` + `kms_alias_names` (→ every data module), `irsa_role_arns` (→ annotate K8s ServiceAccounts), `secret_arns` (→ ESO).

## Dependencies

- **Upstream:** `compute` (OIDC provider) for IRSA roles. KMS + secrets have no upstream (they are foundational and are consumed by `compute`'s secret-encryption — a mild ordering nuance handled by composing KMS first, then compute, then IRSA roles, in the env root).
- **Downstream:** `database`/`cache`/`messaging`/`storage`/`compute` (KMS keys); all workloads (IRSA + secrets).

## Security notes

- **Per-domain keys, rotation on** — blast-radius containment + NFR-SEC-01 at-rest everywhere.
- **IRSA over static creds** — no long-lived cloud credential where a short-lived role works ([09 §10]).
- **No secret values in code** — containers only; this is the structural guarantee behind "secrets never in Git".
- IRSA is the AWS control-plane identity surface; the portability exit maps it to GKE/AKS Workload Identity (ADR-0003 §5).

## How to test in isolation

```bash
terraform -chdir=modules/security init -backend=false
terraform -chdir=modules/security validate
```
