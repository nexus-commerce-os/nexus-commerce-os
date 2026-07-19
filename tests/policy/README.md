# tests/policy — conftest unit tests for the security policies

> **Purpose.** The policies in
> [`infrastructure/security/policies`](../../infrastructure/security/policies) are **code**,
> so they are unit-tested: each rule is asserted to fire on a violating fixture and stay
> silent on a compliant one. A broken policy (one that stops denying) fails CI here before it
> can wave a real violation through.
> **Owner.** `@nexus/sre` + `@nexus/devsecops`.
> **Dependencies.** conftest ≥ 0.55 (OPA/Rego v1); the CI `policy` job runs `conftest verify`.

Certified by docs/10 §5 ("policy test suite (`conftest verify`)" as a control).

## Files

| File | Covers |
|------|--------|
| [`s3_and_tags_test.rego`](s3_and_tags_test.rego) | `deny_public_s3`, `require_tags`, `deny_open_money_sg` (Terraform plan inputs). |
| [`k8s_image_and_limits_test.rego`](k8s_image_and_limits_test.rego) | `deny_latest_image`, `require_resource_limits` (Kubernetes manifest inputs). |

Tests share package `main` with the policies, so each `test_*` rule references `deny`
directly and drives it with `with input as {...}`. Both a **positive** (violation → denied)
and a **negative** (compliant → allowed) case exist per rule, so the tests catch a policy that
silently stops enforcing.

## Run

```bash
conftest verify --policy infrastructure/security/policies --policy tests/policy
```

Expected: all `test_*` rules pass. CI (`.github/workflows/ci.yml`, stage 11) runs this on
every PR; a failing policy test blocks merge.
