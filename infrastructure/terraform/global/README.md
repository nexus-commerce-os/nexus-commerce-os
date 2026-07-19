# Stack: `global` (landing zone)

> Bootstrap singletons shared by every environment: the remote-state backend, the GitHub Actions OIDC provider + least-privilege per-env deploy roles, and org-guardrail artifacts.

| Field | Value |
|-------|-------|
| **Purpose** | Create the one-per-org resources: S3+DynamoDB Terraform state backend (KMS-encrypted), the GitHub OIDC identity provider, per-environment deploy roles (no static keys), and rendered SCP guardrail artifacts. |
| **Owner** | Platform / Cloud Security (`infra-security` + `infra-platform`) |
| **Account** | The shared **platform/security account** (member of the org). Org-level SCP/Config/Control-Tower *attachment* happens in the **management account** (out of this stack's scope). |
| **Maps to** | [10 §5 remote state](../../../docs/10-deployment-architecture.md#5-infrastructure-as-code-iac), [10 §2 OIDC CI](../../../docs/10-deployment-architecture.md#2-ci-pipeline), [09 §10 org guardrails](../../../docs/09-cloud-architecture.md#10-cloud-security-posture); **ADR-0018** (tight OIDC aud+ref conditions, no static runner creds); **ADR-0003** (all infra via Terraform). |

## What it creates

- **Remote state backend** (`state-backend.tf`) — versioned, KMS-encrypted, public-blocked, **TLS-only** S3 bucket + a PAY_PER_REQUEST **DynamoDB lock table** (PITR on). `prevent_destroy` on both.
- **GitHub OIDC** (`oidc.tf`) — `aws_iam_openid_connect_provider` for `token.actions.githubusercontent.com`; thumbprint derived live via the `tls` provider.
- **Per-env deploy roles** (`oidc.tf`) — `for_each` over `var.deploy_roles`; each trust policy pins `aud = sts.amazonaws.com` **and** a `sub` ref/environment pattern, so a PR-branch token can't assume a prod role. **No static access keys exist anywhere.**
- **Guardrail artifacts** (`guardrails.tf`) — rendered SCP JSON (deny prohibited regions; require `owner` tag on new data stores) output for the org admin to attach in the management account.

## Bootstrap sequence (chicken-and-egg)

This stack creates the very bucket other stacks store state in, so:

```bash
cd infrastructure/terraform/global
cp terraform.tfvars.example terraform.tfvars   # fill github_org/repo, deploy_roles

# 1. First apply with LOCAL state (backend block in backend.tf stays commented):
terraform init
terraform apply

# 2. Migrate this stack's own state into the bucket it just made:
#    - uncomment the backend "s3" block in backend.tf, fill in the outputs
#    - then:
terraform init -migrate-state
```

After this, every `envs/<env>` stack points its `backend.tf` at the emitted `tfstate_bucket` / `tflock_table` with its own per-env `key`.

## Inputs / Outputs

**Key inputs:** `org_slug`, `state_region`, `github_org`, `github_repo`, `deploy_roles` (map: ref patterns + least-priv policy), `prohibited_regions`, `tags`.

**Outputs:** `tfstate_bucket`, `tflock_table`, `tfstate_kms_key_arn`, `github_oidc_provider_arn`, `deploy_role_arns` (→ CI `role-to-assume`), `scp_region_deny_json` + `scp_require_tags_json` (→ org admin).

## Security notes

- **No long-lived CI credentials** — CI federates via OIDC; roles are ref/environment-scoped (ADR-0018). Prod role is **environment-scoped** so only the protected GitHub `prod` environment (manual approval) can assume it.
- **State is encrypted, versioned, TLS-only, lockable** — corruption + concurrent-write protection ([10 §5]).
- **Guardrails are least-scope** — this stack renders SCP artifacts but does **not** hold `organizations:*`; attaching them is a management-account action, keeping blast radius small.
- **AWS Config / Control Tower** rules (encryption-at-rest, no-public-S3, required-tags) are documented here for the org admin; they run in the management/audit account.

## How to validate

```bash
terraform -chdir=global init -backend=false
terraform -chdir=global validate
```
