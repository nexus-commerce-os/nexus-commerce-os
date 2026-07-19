# Env: `prod`

> Live, multi-region, full-HA. Phase-1 US residency pair. **Apply is manual-approval only.**

| Field | Value |
|-------|-------|
| **Purpose** | The live environment. Full HA (one egress cell per AZ, multi-AZ data, deletion protection, private EKS API). |
| **Region(s)** | `us-east-1` (primary, live) + `us-west-2` (**in-zone DR pair**, same US residency zone). Further zones (EU, South-Asia) are added phase-by-phase. |
| **Data** | Real, residency-pinned ([09 §6]). |
| **Promotion** | **Manual approval gate** → progressive, region-by-region rollout ([10 §3/§4]). |
| **Maps to** | [09 §6 multi-region + in-zone DR](../../../../docs/09-cloud-architecture.md#6-multi-region-strategy), [10 §3 prod gate](../../../../docs/10-deployment-architecture.md#3-cd-pipeline); **ADR-0016 R-013/R-014** (in-zone DR, region-before-market). |

## Manual-approval-only apply (MUST)

Prod is **never** auto-applied. The path is:

1. CI produces a plan; the **prod GitHub environment** requires reviewers (branch protection + required approvals).
2. The env-scoped OIDC deploy role (`nexus-deploy-prod`, from the `global` stack) can be assumed **only** from that protected environment — a PR-branch token cannot touch prod ([10 §2], ADR-0018).
3. Apply runs only after **2 approvals + a change ticket + a passing rollback-proof id** ([10 §3 promotion flow]).
4. Rollout is **region-by-region** (canary per [10 §4]); the DR region is promoted only via the DR runbook, never casually.

Terraform-level guards reinforce this: data stores carry `prevent_destroy` + `deletion_protection`, so a destructive plan cannot be applied even if approved by mistake.

## Composition

- `module.primary` → `aws` (us-east-1)
- `module.dr` → `aws.dr` (us-west-2, in-zone DR pair)

Same `region-stack` module and shared prod-shaped `locals` as staging — so what passed staging's gates is what runs here.

## Adding a residency zone (phase-by-phase)

Instantiate another `region-stack` with its own provider alias + `vpc_cidr` + **in-zone DR pair**, behind the **region-before-market gate**: the market's country flag cannot flip until the region + DR pair is provisioned and residency-tested, with network default-deny to unlaunched regions (ADR-0016 R-014). Staging already exercises the ap-south-1 tier so this is proven before it lands here.

## Deploy (via CI only)

```bash
# Local plan for review is fine; APPLY is CI-gated (never local apply to prod).
cd infrastructure/terraform/envs/prod
terraform init      # backend from global outputs (prod account)
terraform plan      # reviewed in the change ticket
# apply happens in the protected prod pipeline after approvals.
```
