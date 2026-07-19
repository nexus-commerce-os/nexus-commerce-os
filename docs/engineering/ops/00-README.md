# P0.1 — Installation & Operations Manual

**Status:** 🟢 Runbook · **Scope:** stand up the NEXUS production platform foundation from **a completely empty AWS account and an empty GitHub organization**, ending at an objectively-verified **P0.1 exit gate**. **Do NOT proceed to P0.2 until [Chapter 8](08-exit-gate-validation.md) signs off.**

> This manual *operates* the infrastructure specified in [E1 Engineering Spec](../E1-P0.1-engineering-spec.md) and verifies it against the [E2 Acceptance Tests](../E2-P0.1-acceptance-tests.md). Every step follows the fixed format below.

## Evidence Policy (binding)

**Every `PASS` MUST be backed by an objective evidence artifact.** Acceptable evidence: CLI output · `terraform plan`/`apply` output · GitHub Actions run logs · AWS CLI output · `kubectl` output · screenshots (where appropriate) · CloudTrail events · Prometheus metrics · Grafana dashboards · security-scan reports.

- **No artifact ⇒ Status = `NOT VERIFIED`.** Never mark `PASS` on expectation. Never infer success.
- Three states only: **`NOT VERIFIED`** (default) · **`PASS`** (artifact attached + matches expected) · **`FAIL`** (artifact shows a defect).
- The single source of truth for status is the [Verification Ledger](11-verification-ledger.md). An item is `PASS` **only** when its ledger row has an attached artifact.
- The [Exit-Gate sign-off](08-exit-gate-validation.md) may be signed **only** when every ledger row is `PASS` with evidence.

## Step format (every step MUST have all 8)
**Objective · Prerequisites · Commands · Expected output · Verification · Rollback · Common failure · Troubleshooting.**

## Execution order (dependency-correct)

| Ch | Chapter | Why here |
|----|---------|----------|
| 1 | [GitHub Organization](01-github-org.md) | Source of truth + identity for CI OIDC; no cloud yet |
| 2 | [AWS Foundation](02-aws-foundation.md) | Org, accounts, IAM Identity Center, KMS, CloudTrail/Config/GuardDuty/Security Hub, budgets |
| 3 | [Terraform Bootstrap](03-terraform-bootstrap.md) | **Before any network** — remote state, locking, backend, GitHub-OIDC deploy roles |
| 4 | [Networking](04-networking.md) | VPC/subnets/NAT/route-tables/SGs/NACLs/endpoints — applied via the `network` module |
| 5 | [Kubernetes](05-kubernetes.md) | EKS, node groups, IRSA, autoscaler, ingress, cert-manager, external-dns |
| 6 | [Observability](06-observability.md) | OpenTelemetry, Prometheus, Grafana, Loki, Tempo (separate failure domain) |
| 7 | [CI/CD](07-cicd.md) | Wire + run the pipeline: TF plan/apply, build, SBOM, cosign, scan, deploy, rollback |
| 8 | [Exit-Gate Validation](08-exit-gate-validation.md) | Objectively verify the P0.1 DoD; collect evidence; sign off |
| 9 | [Execution Checklist (Stages A–D)](09-execution-checklist.md) | Condensed tick-box tracker: GitHub · AWS · Terraform idempotency · CI/CD, with exit evidence |
| 10 | [Chaos Day](10-chaos-day.md) | 5 resilience experiments (node kill · pod delete · service restart · NAT failure · IAM revoke) — prove self-recovery |
| 11 | [Verification Ledger](11-verification-ledger.md) | **Authoritative status** — every item `NOT VERIFIED` until an evidence artifact is attached |

> **Sequencing note:** your intake list placed *Networking* before *Terraform Bootstrap*; the manual reverses them because the S3/DynamoDB state backend + OIDC deploy roles are prerequisites for applying the network. This is the only ordering change and it is a correctness fix.

## Conventions
- **Placeholders** in `<ANGLE_BRACKETS>` (e.g. `<ORG>`, `<MGMT_ACCOUNT_ID>`, `<REGION>`) — set once in `env.sh` (never committed).
- **Idempotency:** every `apply` step is safe to re-run; a second run MUST show no changes.
- **No secrets in Git, ever** — OIDC + Secrets Manager only ([E1 §Security](../E1-P0.1-engineering-spec.md)).
- **Rollback is mandatory** — every mutating step documents how to undo it.

## Prerequisites (operator workstation)
`gh` CLI · `aws` CLI v2 · `terraform` ≥ 1.7 · `kubectl` ≥ 1.29 · `helm` ≥ 3.14 · `cosign` · `git` (with GPG/SSH signing configured) · an org owner GitHub account · an AWS management-account login with `AdministratorAccess` for bootstrap only.
