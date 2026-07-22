# infrastructure/terraform

**Purpose:** the entire NEXUS cloud estate as modular, reproducible Terraform (AWS-primary, multi-cloud-capable per [ADR-0003](../../docs/adr/ADR-0003-cloud-provider.md)). **Never one giant project** — eight independent primitives composed per region and per environment.
**Owner:** `@nexus-commerce-os/infrastructure` + `@nexus-commerce-os/cloud-security` ([CODEOWNERS](../../.github/CODEOWNERS)).
**Dependencies:** Terraform ≥ 1.7, AWS provider ~> 5.60; remote state from `global/`; consumed by CI (`terraform validate`/`plan`, [10 §2](../../docs/10-deployment-architecture.md)).

## Layout

| Path | What |
|------|------|
| `modules/network` | 3-tier VPC ×≥3 AZ, egress-cell NAT fleet ([ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md)), isolated data tier, default-deny SGs |
| `modules/compute` | EKS + node pools (discovery/money split, GPU warm floor), IRSA OIDC |
| `modules/database` | Multi-AZ Aurora PostgreSQL, KMS, Secrets-Manager master creds (never in state) |
| `modules/cache` | ElastiCache Redis, money-vs-catalog isolation ([ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md)) |
| `modules/messaging` | MSK (genuine Kafka), TLS + IAM-SASL |
| `modules/storage` | S3 versioned/SSE-KMS/TLS-only, residency precondition ([ADR-0016](../../docs/adr/ADR-0016-region-residency-lifecycle.md)) |
| `modules/security` | Per-domain KMS, exact-match IRSA roles, secret containers (metadata only) |
| `modules/monitoring` | AMP/AMG + self-host hooks, separate failure domain |
| `modules/region-stack` | Composition — "the identical region module" wiring the 8 primitives + in-zone DR |
| `global/` | Remote state backend (S3+DynamoDB), GitHub OIDC provider + scoped deploy roles, SCP artifacts |
| `envs/{dev,staging,prod}` | Thin roots composing `region-stack`; per-env state key; `*.tfvars.example` only |

## Rules
- Each primitive module is independently `terraform validate`-able; composition only in `region-stack`/envs.
- **No secrets, no account IDs, no real `*.tfvars` in Git** — values via tfvars/data sources; credentials via KMS/Secrets Manager/OIDC.
- `staging ≡ prod by construction` (incl. the ap-south-1 regulated tier + in-zone DR).
- Prod apply is **manual approval** ([10 §3](../../docs/10-deployment-architecture.md)).

## Use
```bash
cd envs/dev && terraform init && terraform plan   # backend + tfvars filled from global/ outputs at bootstrap
```
Full estate overview: [`../README.md`](../README.md).
