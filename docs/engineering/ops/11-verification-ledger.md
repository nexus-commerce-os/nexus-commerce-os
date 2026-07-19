# Chapter 11 — P0.1 Verification Ledger

**Status:** 🔴 **P0.1 EXIT GATE: NOT VERIFIED** · **Updated:** 2026-07-14 (initial — no evidence received yet)

> **Single source of truth for verification status.** Governed by the [Evidence Policy](00-README.md#evidence-policy-binding): an item is `PASS` **only** with an attached objective artifact that matches the expected output. **No artifact ⇒ `NOT VERIFIED`. Never infer.**
>
> **Current honest state:** nothing has been executed in a live environment and no evidence has been submitted, so **every item below is `NOT VERIFIED`.** As you run each item ([Execution Checklist](09-execution-checklist.md) / [Chaos Day](10-chaos-day.md)) and paste its output, the row is updated to `PASS` (with the artifact reference) or `FAIL`.

## Acceptance standard (Founder-set, Stage A onward)
- **Three evidence types per item:** ① CLI output · ② GitHub/Console UI screenshot (where applicable) · ③ **negative test** (the policy actually *enforces* — e.g. an unsigned commit is rejected, a direct push is blocked).
- **Evidence IDs:** `EV-<ITEM>-<NNN>` (e.g. `EV-A3-001`). The ledger row references the ID, not the raw dump.
- **Evidence Quality Score (EQS):** 5 = CLI + screenshot + negative test + logs · 4 = CLI + screenshot · 3 = CLI only · 2 = screenshot only · 1 = claim only. **`PASS` requires EQS ≥ 4.**
- **State machine:** `PASS` = CLI + screenshot + negative test + Evidence ID + EQS ≥ 4. If **any** of these is missing ⇒ **`NOT VERIFIED`** (never `FAIL`). `FAIL` is reserved for an artifact that *shows a defect*. **Absence of evidence ≠ evidence of failure.**
- **Record format (per verified item):** `Status · Evidence: EV-xx-nnn · EQS: n/5 · Verified by: <reviews> · Remarks: …`.

> **Process ≤ product (Founder guidance):** this is the *final* verification standard for P0.1. No further verification frameworks will be added. Once P0.1 evidence is collected and the gate signed, work moves to real development — governance exists to reduce risk, not to stall progress.

## Legend
`NOT VERIFIED` = no evidence yet (default) · `PASS` = the full acceptance standard above met (EQS ≥ 4) · `FAIL` = an attached artifact shows a defect.

## Stage A — GitHub
| Item | Check | Status | Evidence artifact |
|------|-------|--------|-------------------|
| A1 | Org created | 🟢 **PASS** (EQS 4/5) | **EV-A1-001** — API `orgs/nexus-commerce-os` → `{login:"nexus-commerce-os", id:306595611, type:"Organization"}` + org-overview UI screenshot. (negative-test N/A: existence check) |
| A2 | Repository | 🟢 **PASS** (EQS 4/5) | **EV-A2-001** — authenticated repo page `nexus-commerce-os/nexus-commerce-os`: **Private** badge + `main` branch + initial commit + README (console-equivalent UI screenshot). Optional supplement: `gh repo view` CLI. |
| A3 | Branch protection | 🔴 NOT VERIFIED | — |
| A4 | Ruleset active | 🔴 NOT VERIFIED | — |
| A5 | CODEOWNERS enforced | 🔴 NOT VERIFIED | — |
| A6 | Signed commits required | 🔴 NOT VERIFIED | — |
| A7 | Required reviews | 🔴 NOT VERIFIED | — |
| A8 | Required checks (`ci-gate`) | 🔴 NOT VERIFIED | — |
| A9 | OIDC identity | 🔴 NOT VERIFIED | — |
| A10 | Environments | 🔴 NOT VERIFIED | — |

## Stage B — AWS
| Item | Check | Status | Evidence artifact |
|------|-------|--------|-------------------|
| B1 | Organization (ALL features) | 🔴 NOT VERIFIED | — |
| B2 | IAM Identity Center | 🔴 NOT VERIFIED | — |
| B3 | SCP guardrails | 🔴 NOT VERIFIED | — |
| B4 | CloudTrail (org) | 🔴 NOT VERIFIED | — |
| B5 | GuardDuty | 🔴 NOT VERIFIED | — |
| B6 | Security Hub | 🔴 NOT VERIFIED | — |
| B7 | AWS Config | 🔴 NOT VERIFIED | — |
| B8 | Budgets + anomaly | 🔴 NOT VERIFIED | — |
| B9 | KMS audit CMK | 🔴 NOT VERIFIED | — |

## Stage C — Terraform (idempotency)
| Item | Check | Status | Evidence artifact |
|------|-------|--------|-------------------|
| C1 | `fmt -check` clean | 🔴 NOT VERIFIED | — |
| C2 | `validate` all modules/envs | 🔴 NOT VERIFIED | — |
| C3 | `plan` reviewed | 🔴 NOT VERIFIED | — |
| C4 | `apply` complete | 🔴 NOT VERIFIED | — |
| C5 | **re-plan exit 0 (no-op)** | 🔴 NOT VERIFIED | — |
| C6 | `destroy` complete | 🔴 NOT VERIFIED | — |
| C7 | re-apply from clean | 🔴 NOT VERIFIED | — |
| C8 | **re-plan exit 0 again** | 🔴 NOT VERIFIED | — |

## Stage D — CI/CD
| Item | Check | Status | Evidence artifact |
|------|-------|--------|-------------------|
| D1 | Pipeline green · `ci-gate` | 🔴 NOT VERIFIED | — |
| D2 | SAST (+ seeded-fault fails) | 🔴 NOT VERIFIED | — |
| D3 | Secret scan (+ planted-secret fails) | 🔴 NOT VERIFIED | — |
| D4 | Dependency scan | 🔴 NOT VERIFIED | — |
| D5 | SBOM produced | 🔴 NOT VERIFIED | — |
| D6 | Cosign verify (+ unsigned rejected) | 🔴 NOT VERIFIED | — |
| D7 | Terraform plan (OIDC) | 🔴 NOT VERIFIED | — |
| D8 | Build (distroless) | 🔴 NOT VERIFIED | — |
| D9 | Deploy → staging (ArgoCD) | 🔴 NOT VERIFIED | — |
| D10 | Rollback drill (+ restore time) | 🔴 NOT VERIFIED | — |
| D11 | Chaos Day complete | 🔴 NOT VERIFIED | — |

## Chaos Day (EXP)
| Item | Experiment | Status | Evidence artifact |
|------|-----------|--------|-------------------|
| EXP-1 | Node kill → reschedule + replace | 🔴 NOT VERIFIED | — |
| EXP-2 | Pod delete → ReplicaSet heal | 🔴 NOT VERIFIED | — |
| EXP-3 | Service restart → zero-downtime | 🔴 NOT VERIFIED | — |
| EXP-4 | NAT failure → egress redundancy | 🔴 NOT VERIFIED | — |
| EXP-5 | IAM revoke → contained + observable | 🔴 NOT VERIFIED | — |

## Definition-of-Done rollup (from [Ch8](08-exit-gate-validation.md))
| DoD | Status | Depends on |
|-----|--------|-----------|
| DoD-1 deployable | 🔴 NOT VERIFIED | C3–C4 |
| DoD-2 idempotent | 🔴 NOT VERIFIED | C5, C8 |
| DoD-3 CI passes | 🔴 NOT VERIFIED | D1–D9 |
| DoD-4 rollback tested | 🔴 NOT VERIFIED | D10 |
| DoD-5 docs updated | 🟡 PASS-candidate (lint green in-repo; needs reviewer confirmation) | lint output |
| DoD-6 architecture unchanged | 🟡 PASS-candidate (lint green; frozen docs) | git diff |
| DoD-7 no Critical findings | 🔴 NOT VERIFIED | D2–D6, B5/B6 |

> **DoD-5/DoD-6 are marked PASS-candidate, not PASS** — the in-repo lint is green (objective, re-runnable: `python scripts/doc_consistency_lint.py`), but per the Evidence Policy a reviewer must confirm the artifact before flipping to `PASS`. Everything else is `NOT VERIFIED` until you submit live evidence.

## Rollup
**P0.1 EXIT GATE = 🔴 NOT VERIFIED.** **2 / 44 items `PASS`** (A1 org, A2 repo). P0.2 remains blocked.

---
*Update protocol: paste an item's command output → it is checked against the Chapter's Expected output → the row flips to `PASS` (artifact linked) or `FAIL`. This ledger, plus the [Ch8 sign-off](08-exit-gate-validation.md), is the exit-gate record.*
