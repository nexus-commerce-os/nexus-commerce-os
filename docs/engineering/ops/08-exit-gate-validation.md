# Chapter 8 — Exit-Gate Validation

**Status:** 🟢 Runbook (the sign-off chapter) · **Depends on:** Chapters 1–7 complete in your live environment.

> **This is the gate.** P0.1 is done **only** when every Definition-of-Done item below is verified with a collected artifact and the sign-off block is filled. **Do NOT begin P0.2 until this chapter reads ✅ across the board.** No inference, no "should pass" — objective evidence only.

## How to use this chapter
Run each verification, capture the named artifact into an **evidence register** (a PR, a run URL, a CLI transcript, a screenshot), and mark the row. Verifications map to the [E2 Acceptance Test Spec](../E2-P0.1-acceptance-tests.md) (`AT-P01-xx`) — this chapter *executes* them against the live platform.

---

## 1. Definition-of-Done verification

### DoD-1 — Infrastructure can be deployed repeatedly
- **Objective:** a full `terraform apply` of `envs/dev` (then `staging`) succeeds from clean.
- **Prerequisites:** Ch3 (state) + Ch4/5 applied.
- **Commands:**
  ```bash
  cd infrastructure/terraform/envs/dev && terraform init && terraform apply
  ```
- **Expected output:** `Apply complete!` with the created resource counts.
- **Verification:** all AWS resources exist (`aws eks describe-cluster`, `aws ec2 describe-vpcs`). Maps to **AT-P01-14…19**.
- **Evidence:** apply transcript + resource-list output.

### DoD-2 — Infrastructure is idempotent
- **Objective:** re-running apply changes nothing.
- **Commands:**
  ```bash
  terraform plan -detailed-exitcode   # exit 0 = no changes
  ```
- **Expected output:** `No changes. Your infrastructure matches the configuration.` (exit code **0**).
- **Verification:** exit code 0 on a 2nd `plan` for every env. Maps to **AT-P01-16**.
- **Evidence:** the `plan -detailed-exitcode` output showing exit 0.
- **Common failure:** a resource with a computed/drifting attribute shows a perpetual diff → pin it or add `ignore_changes`.

### DoD-3 — CI passes
- **Objective:** the 18-job pipeline is green on a real PR, `ci-gate` ✅.
- **Commands:**
  ```bash
  gh pr create --fill && gh pr checks --watch
  ```
- **Expected output:** every required check ✅; `ci-gate` success.
- **Verification:** the `ci-gate` aggregate is a **required** status check (Ch1) and it passed. Maps to **AT-P01-05…13, 20…27**.
- **Evidence:** the PR checks URL.
- **Note:** also confirm each gate **fails-closed** — run the seeded-fault matrix (AT-P01 seeded faults: planted secret → gitleaks fails; `:latest` image → policy fails; doc-lint violation → build fails).

### DoD-4 — Rollback tested
- **Objective:** a deliberately-bad deploy auto-rolls-back within the stated time.
- **Commands:** deploy a failing `platform-hello` image tag to staging via GitOps; observe ArgoCD/rollback.
- **Expected output:** SLO-breach/health-failure triggers automatic revert to the last-good revision.
- **Verification:** service healthy again within the documented RTO; the rollback is recorded. Maps to **AT-P01-30, 31**.
- **Evidence:** rollback event log + restore-time measurement.

### DoD-5 — Documentation updated
- **Objective:** every directory documented; specs current; lint green.
- **Commands:**
  ```bash
  python scripts/doc_consistency_lint.py && python scripts/mermaid_validate.py
  ```
- **Expected output:** both `PASS`.
- **Verification:** 53+ governance READMEs present; E1–E4 + this manual exist. Maps to **AT-P01-01…04**.
- **Evidence:** lint PASS output.

### DoD-6 — Architecture unchanged
- **Objective:** no certified architecture doc (01–13) was modified by infra work.
- **Commands:**
  ```bash
  git diff --name-only <baseline>..HEAD -- docs/ | grep -vE 'docs/engineering|docs/review' || echo "no certified-doc changes"
  ```
- **Expected output:** `no certified-doc changes`.
- **Verification:** doc-consistency lint green confirms no drift.
- **Evidence:** the diff output.

### DoD-7 — No Critical security findings
- **Objective:** zero High/Critical vulns; images signed; SBOM present.
- **Commands:**
  ```bash
  cosign verify <ECR>/platform-hello@<digest> --certificate-identity-regexp <CI_ID> --certificate-oidc-issuer https://token.actions.githubusercontent.com
  # container/dep scan summary from the CI run; GuardDuty + Security Hub dashboards
  ```
- **Expected output:** signature verified; scan summary = 0 High/Critical; SBOM attached.
- **Verification:** admission rejects an **unsigned** image (test it). GuardDuty/Security Hub clean. Maps to **AT-P01-28, 29, 32, 33**.
- **Evidence:** cosign verify output + scan summary + Security Hub screenshot.

---

## 2. Platform-hello end-to-end (the canary)
- **Objective:** prove the whole path — deploy → probe → trace → scrape → log.
- **Verification (maps to AT-P01-20…24):**
  - `curl https://hello.<staging-domain>/healthz` → `200`
  - `/readyz` gates traffic (returns 503 when a dep is down)
  - a request produces a **trace in Tempo**, **metrics in Prometheus** (`/metrics` scraped), **logs in Loki**
  - the golden-signals Grafana dashboard renders live data.
- **Evidence:** Tempo trace link + Grafana dashboard screenshot.

## 3. Evidence register (fill and attach)

| DoD | Verified? | Evidence artifact | Signed by | Date |
|-----|-----------|-------------------|-----------|------|
| DoD-1 deployable | ☐ | | | |
| DoD-2 idempotent | ☐ | | | |
| DoD-3 CI passes | ☐ | | | |
| DoD-4 rollback tested | ☐ | | | |
| DoD-5 docs updated | ☐ | | | |
| DoD-6 arch unchanged | ☐ | | | |
| DoD-7 0 Critical findings | ☐ | | | |
| Canary e2e | ☐ | | | |

## 4. Sign-off

> **P0.1 EXIT GATE — PASS requires all rows ✅ with attached evidence AND the four approvals below ([ADR-0023](../../adr/ADR-0023-doc-freeze-and-approval-gate.md)). Each approval MUST cite an evidence artifact — an approval with no cited artifact is void.**
>
> | Approver | Approves (evidence) | Signature | Evidence ref | Date |
> |----------|---------------------|-----------|--------------|------|
> | **Engineering Lead** | build correctness + idempotency (C5/C8) | | | |
> | **Security Lead** | 0 High/Critical, signing/SBOM, IAM least-priv (D2–D6) | | | |
> | **Platform Lead** | deploy + observability + rollback (D9/D10, canary e2e) | | | |
> | **Founder** | business go/no-go | | | |
>
> **Only after every DoD row is ✅ and all four approvals are signed with evidence may P0.2 begin.** Record the sign-off in [`PROJECT_MEMORY.md`](../../../PROJECT_MEMORY.md).

## 5. Rollback of the whole gate (if it fails)
If any DoD fails and cannot be fixed forward safely: `terraform destroy` the affected env (dev/staging are disposable; prod is not yet created at P0.1), fix the root cause, and re-run this chapter. The platform is disposable-by-design at P0.1 precisely so the gate can be re-run cleanly.

---
*Back to [manual index](00-README.md) · Acceptance tests: [E2](../E2-P0.1-acceptance-tests.md) · Roadmap: [E3](../E3-P0.2-P0.8-roadmap.md).*
