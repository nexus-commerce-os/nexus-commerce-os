# infrastructure/security/policies — OPA/Rego + conftest policy

> **Purpose.** The policy-as-code rules enforced **twice** (defense-in-depth, docs/10 §5):
> at **plan-time** in CI (`conftest test` on the `terraform plan` JSON and rendered
> Kubernetes manifests) and at **admission-time** in-cluster (Kyverno/Gatekeeper mirror).
> **Owner.** `@nexus/cloud-security`.
> **Dependencies.** conftest ≥ 0.55 (OPA/Rego v1); the CI `policy` job
> ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)); unit tests in
> [`tests/policy`](../../../tests/policy).

Certified by docs/10 §5 (plan-time + admission-time policy-as-code) and docs/08 §1.1 / §4.

## Rules

| File | Rule | Certified by |
|------|------|--------------|
| [`deny_public_s3.rego`](deny_public_s3.rego) | No public S3 ACL; all four public-access-block flags MUST be true. | docs/10 §5, docs/08 §4 |
| [`deny_open_money_sg.rego`](deny_open_money_sg.rego) | No `0.0.0.0/0` ingress on money-path (Zone 4 / `DataClass=C4`) security groups. | docs/08 §1.1, docs/10 §5 |
| [`require_tags.rego`](require_tags.rego) | Mandatory `Owner`, `Environment`, `CostCenter`, `DataClass` tags on taggable resources. | docs/10 §5, docs/08 §4.1 |
| [`deny_latest_image.rego`](deny_latest_image.rego) | No `:latest`; images MUST pin an immutable git-SHA tag or digest. | docs/10 §3/§5, ADR-0010 |
| [`require_resource_limits.rego`](require_resource_limits.rego) | Every container declares CPU/memory requests **and** limits. | docs/10 §5 |

All rules use package `main` and the conftest `deny contains msg` convention, so
`conftest test <input> --policy infrastructure/security/policies` fails closed on any violation.

## Run locally

```bash
# unit-test the policies (they are code — they get tested):
conftest verify --policy infrastructure/security/policies --policy tests/policy

# enforce against a plan:
terraform -chdir=infrastructure/terraform/envs/staging show -json tfplan.binary > tfplan.json
conftest test tfplan.json --policy infrastructure/security/policies --all-namespaces

# enforce against rendered k8s manifests:
helm template <chart> | conftest test - --policy infrastructure/security/policies
```

## Defense-in-depth note

These same intents are enforced **again** at cluster admission (Kyverno/Gatekeeper) so a
manifest that bypasses CI still cannot run — CI is the first gate, admission is the last
(docs/10 §5, "Policies run in CI **and** in-cluster").
