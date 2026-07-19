# NEXUS Infrastructure — P0.1 Foundation

> **Scope:** platform foundation only (no business/commerce/AI logic). Terraform provisions everything *before/around* Kubernetes; Helm/ArgoCD (elsewhere) own everything *inside* the cluster ([10 §5] IaC seam). This README covers the **Terraform** estate. Sibling dirs `kubernetes/`, `github/`, `monitoring/`, `security/` are owned by other P0.1 workstreams.

This estate conforms to the **CERTIFIED, FROZEN** architecture in [`/docs`](../docs/00-README.md) — it implements those docs; it does not change them. Primary sources: [09 Cloud Architecture](../docs/09-cloud-architecture.md), [10 Deployment Architecture](../docs/10-deployment-architecture.md), and ADRs [0003](../docs/adr/ADR-0003-cloud-provider.md) / [0016](../docs/adr/ADR-0016-region-residency-lifecycle.md) / [0017](../docs/adr/ADR-0017-blast-radius-isolation.md) / [0019](../docs/adr/ADR-0019-portability-ops-maturity.md).

---

## Module map

```
terraform/
  versions.tf                 # CANONICAL provider-pin reference (all modules mirror it)
  global/                     # landing zone: remote-state backend, GitHub OIDC + deploy roles, org guardrails
  modules/                    # 8 independent primitives + 1 composition module
    network/                  #  VPC (3-tier × ≥3 AZ) · egress-cell fleet · PrivateLink · internet-isolated data tier
    compute/                  #  EKS · discovery/money/GPU-warm/spot node pools · IRSA OIDC
    database/                 #  Aurora PostgreSQL · multi-AZ · KMS · Secrets-Manager master cred
    cache/                    #  ElastiCache Redis · money vs catalog isolated clusters
    messaging/                #  MSK (Apache Kafka) · TLS+IAM-SASL · Prometheus exporters
    storage/                  #  S3 · versioned/encrypted/TLS-only · residency-guarded CRR
    security/                 #  per-domain KMS · scoped IRSA roles · Secrets containers (no values)
    monitoring/               #  AMP/AMG + self-host hooks · separate failure domain
    region-stack/             #  COMPOSITION: wires the 8 into one self-similar region
  envs/
    dev/                      #  1 region  (us-east-1), scaled-down
    staging/                  #  3 regions (us-east-1 + ap-south-1 regulated + ap-south-2 in-zone DR) — prod-identical
    prod/                     #  2 regions (us-east-1 + us-west-2 in-zone DR), manual-approval apply
```

Each of the 8 primitives ships: `versions.tf` · `variables.tf` (typed/validated/described) · `main.tf` · `outputs.tf` · a **README design doc** (purpose · owner · dependencies · I/O · security notes · ADR mapping). Every one is **independently `terraform validate`-able** — no hidden cross-module coupling; composition happens only in `region-stack` and `envs/`.

### How the modules realize the certified decisions

| Concern | Module(s) | Doc / ADR |
|---------|-----------|-----------|
| AWS-primary, upstream K8s, no PaaS lock-in | `compute` | ADR-0003, [09 §1/§3] |
| 3-tier VPC, internet-isolated data, PrivateLink | `network` | [09 §4] |
| Egress cells (de-SPOF, not one chokepoint) | `network` | ADR-0017 R-020 |
| Discovery vs money node-pool split; GPU warm floor | `compute` | ADR-0017 R-059/R-078 |
| Money vs catalog Redis isolation | `cache` | ADR-0017 R-082 |
| Portable-Postgres-only Aurora; DR on portable path | `database` | ADR-0003, ADR-0016 R-036 |
| Genuine Kafka; replication scoped non-personal/in-zone | `messaging` | ADR-0003, ADR-0016 R-013 |
| Residency-guarded S3 CRR (no personal data cross-region) | `storage` | ADR-0016 R-013 |
| Per-domain KMS, IRSA least-privilege, no secrets in Git | `security` | [09 §10] |
| Observability in a separate failure domain | `monitoring` | ADR-0017 R-060 |
| Identical region module + in-zone DR pair | `region-stack`, `envs/*` | [09 §6], ADR-0016 R-013/R-014 |
| Remote state, GitHub OIDC (no static keys), guardrails | `global` | [10 §2/§5], ADR-0018 |

---

## Security posture (P0.1 non-negotiables)

- **No static cloud credentials, anywhere.** CI federates to AWS via **GitHub OIDC**; per-env deploy roles are ref/environment-scoped (a PR token can't assume prod). Provisioned by `global/` ([10 §2], ADR-0018).
- **No secret values in Git or state.** Aurora master credential is AWS-managed in Secrets Manager; `security/` creates secret *containers* only (no `secret_version`); Redis/Kafka use RBAC/IAM-SASL. Read into pods via External Secrets Operator.
- **Encrypted everywhere.** Customer-managed **KMS** per data domain; at-rest on every store; in-transit TLS + (in-cluster) mesh mTLS.
- **Private-by-default networking.** Only the public tier has an internet route; nodes are private; the **data tier has no internet/NAT route**; app→data is by **SG-reference, not CIDR**.
- **Least privilege identity.** **IRSA** gives each pod a scoped role tied to one ServiceAccount — no node-wide creds.
- **Guardrails.** `global/` renders SCP artifacts (deny prohibited regions; require `owner` tag on data stores); AWS Config/Control Tower run in the management account. Untagged resource ⇒ SCP deny (FinOps).
- **Data-loss guards.** `prevent_destroy` + `deletion_protection` on stateful resources; versioned/lockable remote state.

---

## Running `terraform` per environment

Prereq: **Terraform ≥ 1.7**, AWS credentials for the target account (locally via SSO; in CI via the OIDC deploy role — never static keys).

### One-time: bootstrap the landing zone

```bash
cd terraform/global
cp terraform.tfvars.example terraform.tfvars   # set github_org/repo, deploy_roles
terraform init && terraform apply              # creates state bucket + lock table (local state)
# then uncomment backend.tf, fill from outputs, and:
terraform init -migrate-state                  # move global state into the bucket it just made
```

### Per environment (dev / staging / prod)

```bash
cd terraform/envs/<env>
cp terraform.tfvars.example terraform.tfvars    # copy — real tfvars are gitignored
# fill backend.tf bucket/table/kms from the global outputs, then:
terraform init
terraform plan                                  # review the diff
terraform apply                                 # see promotion rules below
```

- **dev** — auto-applied by CI on merge to `main`.
- **staging** — auto-synced tagged release candidates; SLO/load/chaos/**DR & residency** gates must pass ([10 §3/§8]).
- **prod** — **manual-approval only**: 2 approvals + change ticket + passing rollback-proof id, then progressive **region-by-region** rollout. The prod OIDC role is assumable only from the protected GitHub `prod` environment ([10 §3], ADR-0018).

> **Never `terraform apply` to prod locally.** Apply runs in the gated pipeline. Data stores carry `prevent_destroy`, so a destructive plan cannot land even if mistakenly approved.

### Validate a single module in isolation

```bash
terraform -chdir=modules/<name> init -backend=false
terraform -chdir=modules/<name> validate
terraform fmt -recursive -check
```

---

## P0.1 exit gate

> **"Infra deploys automatically, idempotently."**

This is met when:

1. `terraform fmt -recursive -check` is clean and every module + env **`terraform validate`s** (CI runs both).
2. The `global` landing zone is applied and remote state is migrated to S3+DynamoDB.
3. Each env `plan` is reproducible from Git + pinned inputs (no click-ops); a second `apply` with no code change is a **no-op** (idempotent).
4. CI authenticates via **OIDC only** (no static keys) and a **tested rollback** exists for infra changes (revert the pinned module PR / drain back to the prior blue-green node group — [10 §4.1]).
5. Drift detection: scheduled read-only `terraform plan` on all envs; any non-empty plan raises a drift ticket ([10 §5]).

**STOP after P0.1.** Do not begin P0.2 without explicit approval (repo [README](../README.md)).
