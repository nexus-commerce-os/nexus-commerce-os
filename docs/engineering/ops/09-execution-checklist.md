# Chapter 9 — P0.1 Execution Checklist (Stages A–D)

**Status:** 🟢 Execution tracker · **Use:** tick each box **only** after you've run it in your real environment and captured the exit evidence. This is the condensed tracker; the *how* for each item is in Chapters [1](01-github-org.md)–[7](07-cicd.md); the sign-off is [Chapter 8](08-exit-gate-validation.md).

> **Who runs this:** you (the operator), in your live GitHub org + AWS account. AI-DOS **cannot execute** these (no cloud/GitHub access) — paste each command's output back and it will verify against the expected evidence and troubleshoot.

---

## Stage A — GitHub (real)

| # | Verify | Command / evidence | Exit evidence | ☐ |
|---|--------|--------------------|---------------|---|
| A1 | Organization created | `gh api orgs/<ORG>` | JSON with `login=<ORG>` + screenshot | ☐ |
| A2 | Repository created | `gh repo view <ORG>/<REPO> --json name,visibility` | private repo · screenshot | ☐ |
| A3 | Branch protection on `main` | `gh api repos/<ORG>/<REPO>/branches/main/protection` | required checks + reviews + linear + signed = true | ☐ |
| A4 | Ruleset active | `gh api repos/<ORG>/<REPO>/rulesets` | ruleset `enforcement=active` | ☐ |
| A5 | CODEOWNERS enforced | open a PR touching `/docs`; observe required `@nexus/architecture` review | PR screenshot showing required owner review | ☐ |
| A6 | Signed commits required | push an **unsigned** commit → rejected | rejection message | ☐ |
| A7 | Required reviews | PR merge blocked with 0 approvals | blocked-merge screenshot | ☐ |
| A8 | Required checks | PR merge blocked while `ci-gate` pending/failing | blocked-merge screenshot | ☐ |
| A9 | OIDC identity | GitHub OIDC subject claims match `oidc-trust.md` | the `sub`/`aud` config | ☐ |
| A10 | Environments | `staging` auto, `production` reviewers + wait timer | `gh api repos/<ORG>/<REPO>/environments` | ☐ |

**Stage A exit:** all ☐ ✅ with GitHub screenshots + `gh` outputs attached.

## Stage B — AWS (real)

| # | Verify | Command | Exit evidence | ☐ |
|---|--------|---------|---------------|---|
| B1 | Organization (all features) | `aws organizations describe-organization` | `FeatureSet=ALL` | ☐ |
| B2 | IAM Identity Center | `aws sso-admin list-instances` | instance ARN + permission sets | ☐ |
| B3 | SCP guardrails attached | `aws organizations list-policies --filter SERVICE_CONTROL_POLICY` | deny-root / region-allowlist SCPs attached | ☐ |
| B4 | CloudTrail (org) | `aws cloudtrail get-trail-status --name <ORG_TRAIL>` | `IsLogging=true`, multi-region, to security acct | ☐ |
| B5 | GuardDuty (org) | `aws guardduty list-detectors` | detector enabled, delegated admin = security | ☐ |
| B6 | Security Hub | `aws securityhub get-enabled-standards` | CIS + AWS-FSBP enabled | ☐ |
| B7 | AWS Config | `aws configservice describe-configuration-recorder-status` | recording=true | ☐ |
| B8 | Budgets + anomaly | `aws budgets describe-budgets --account-id <ACCT>` | per-account budget + alarm | ☐ |
| B9 | KMS audit CMK | `aws kms describe-key --key-id <AUDIT_CMK>` | enabled, rotation on | ☐ |

**Stage B exit:** all ☐ ✅ with AWS Console + CLI outputs attached.

## Stage C — Terraform (real — idempotency proof)

The idempotency proof is the **destroy → apply → re-plan-no-op** cycle. Run per env (`dev` first).

| # | Step | Command | Expected | ☐ |
|---|------|---------|----------|---|
| C1 | Format | `terraform -chdir=infrastructure/terraform fmt -check -recursive` | clean (exit 0) | ☐ |
| C2 | Validate | per-module `terraform validate` | `Success` for all 9 modules + envs | ☐ |
| C3 | Plan | `terraform -chdir=infrastructure/terraform/envs/dev plan` | reviewed, no surprises | ☐ |
| C4 | Apply | `… apply` | `Apply complete!` | ☐ |
| C5 | **Re-plan = no-op** | `… plan -detailed-exitcode` | **exit 0** (no changes) → idempotent | ☐ |
| C6 | Destroy | `… destroy` | `Destroy complete!` | ☐ |
| C7 | **Re-apply from clean** | `… apply` | `Apply complete!` — identical resources | ☐ |
| C8 | Re-plan = no-op again | `… plan -detailed-exitcode` | **exit 0** | ☐ |

> **Idempotency is proven** when C5 and C8 both exit 0, and C6→C7 rebuilds identically. Do the destroy/apply cycle on **dev/staging only** (disposable) — never on a live prod holding data.

**Stage C exit:** C1–C8 ✅, both no-op plans captured. Maps to [AT-P01-14…19](../E2-P0.1-acceptance-tests.md).

## Stage D — CI/CD (real)

| # | Verify | How | Exit evidence | ☐ |
|---|--------|-----|---------------|---|
| D1 | Pipeline runs on PR | `gh pr create --fill && gh pr checks --watch` | all 18 jobs, `ci-gate` ✅ | ☐ |
| D2 | SAST | CodeQL/Semgrep job green; seed a flaw → fails | run log | ☐ |
| D3 | Secret scan | gitleaks green; plant a secret → fails-closed | run log | ☐ |
| D4 | Dependency scan | osv/dep job green | run log | ☐ |
| D5 | SBOM | Syft→CycloneDX artifact attached | SBOM artifact | ☐ |
| D6 | Cosign | `cosign verify …` passes; unsigned image → admission-rejected | verify output | ☐ |
| D7 | Terraform Plan | read-only OIDC plan in CI | plan job log | ☐ |
| D8 | Build | multi-stage distroless image | image digest | ☐ |
| D9 | Deploy | GitOps → staging (ArgoCD synced) | ArgoCD synced screenshot | ☐ |
| D10 | Rollback drill | bad deploy → auto-rollback; capture restore time | rollback event + timing | ☐ |
| D11 | **Chaos Day** | run [Chapter 10 — Chaos Day](10-chaos-day.md) | experiment records | ☐ |

**Stage D exit:** D1–D11 ✅.

---

## Evidence bundle → sign-off
Collect all four stages' evidence into the [Chapter 8 evidence register](08-exit-gate-validation.md#3-evidence-register-fill-and-attach), complete the multi-role sign-off, and record it in [`PROJECT_MEMORY.md`](../../../PROJECT_MEMORY.md). **Only then may P0.2 begin.**
