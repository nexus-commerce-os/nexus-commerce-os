# 04 — Architecture Review Report v2 (Ultra Adversarial Review, Round 2)

**Status:** 🔴 **NO-GO** · **Owner:** Review Board Chair · **Date:** 2026-07-14
**Scope:** NEXUS Phase-0 architecture (docs 01–10 + ADR-0001…0021) after the R1 remediation pass. Re-attacked by 16 verify/attack auditors across architecture, security, scalability, maintainability, documentation.
**Companion:** [03-master-risk-register-v2.md](03-master-risk-register-v2.md) · [R1 report](00-architecture-review-report-v1.md) · [R1 register](01-master-risk-register.md)

---

## 1. Executive summary

The R1 remediation is **substantial and genuine — not fitness-function theatre**. Of the 24 R1 Criticals, **15 are fully closed** with concrete, cross-consistent mechanisms present in the doc bodies (provisional non-payable postback accrual, per-context sub-ledgers, wallet hold-gate, deterministic price verification, canonical integer-minor-units money type, out-of-process connector sandboxing, singleflight coalescing, cellular egress, region-before-market gate). Readiness rose in four of five dimensions (Arch 62→73, Sec 60→74, Scale 63→78, Doc 85→80*, Maint 68→66*).

**But the gates do not pass, and honesty forbids saying otherwise.** Three independent classes of blocker remain:

1. **Four R1 Criticals are still fully open** — R-021 and R-022 have their *real* fix parked in **ADR-0021 (PENDING APPROVAL)**; R-023 and R-024 are **approval-gated legal Criticals** that, by mandate, cannot be scored closed.
2. **Five R1 Criticals are only partially closed** — R-009, R-012, R-014, R-019, R-020 each had their core addressed but leave the specific sub-scenario the finding named still live.
3. **The remediation pass introduced or exposed nine new Critical-level defects** — including a defeat-device-shaped unblinded reconciliation panel (NC-1), an uncompensated 3-way sub-ledger fan-out (NC-2), reversal ordering keyed on an attacker-suppliable timestamp (NC-3), the money-integrity ADRs being **absent from the execution plan** (NC-4), a phantom closure of R-081 (NC-5), an ADR-vs-ADR contradiction on R-022 (NC-6), and the scalability model never being re-run against the new topology (NC-7).

\* Maintainability and Documentation dropped because the attack pass found governance/consistency defects (NC-4/5/6/8) that outweigh the per-document quality gains.

**Recommendation: NO-GO for P0.** See §6.

---

## 2. What changed since Round 1

| Metric | R1 | R2 |
|---|---|---|
| R1 Criticals fully closed | 0 | **15 / 24** |
| R1 Criticals partially closed | — | 5 |
| R1 Criticals still fully open | 24 | 4 |
| New Critical-level defects | — | **9** |
| R1 Highs fully closed (approx.) | 0 | ~18 / 34 |
| Phantom closures detected | — | 1 (R-081) |
| Architecture | 62 | **73** (+11) |
| Security | 60 | **74** (+14) |
| Scalability | 63 | **78** (+15) |
| Maintainability | 68 | **66** (−2) |
| Documentation | 85 | **80** (−5) |

**Genuinely closed (verified, not cited):** revenue-integrity (R-001/002/003/033/084/085), ledger SPOF (R-004), cashback hold-gate (R-005), AI trust/cost cluster (R-006/007/011/048–057), region/residency (R-010/013/015/036), connector/supply-chain (R-016/017/065–068/071), scale/perf (R-008/029/060/078/080/082/083). Full evidence in register v2 §2.

---

## 3. Honest gate table

| Dimension | Score | Gate | Pass? | Blocking reason |
|-----------|-------|------|-------|-----------------|
| Architecture | 73 | ≥95 | ❌ | New Criticals NC-2 (uncompensated sub-ledger fan-out) & NC-3 (untrusted-timestamp ordering); R-034/035/069 residuals. |
| Security | 74 | ≥95 | ❌ | **Honest ceiling: R-023/R-024 open (ADR-0021 PENDING)** + new Critical NC-1 (unblinded audit panel); reversal-path/fingerprint-griefing Highs. |
| Scalability | 78 | ≥95 | ❌ | NC-7 (scale sim never re-run — gate uncertifiable with numbers); partial Criticals R-009/014/020. |
| Maintainability | 66 | ≥95 | ❌ | NC-4 (money-integrity remediation absent from execution plan) — a governance Critical; stale ADR-0004; dual-invariant lockstep burden. |
| Documentation | 80 | ≥98 | ❌ | **Honest ceiling (R-023/024)** + genuine contradictions NC-5/NC-6/NC-8 and money-type schema-vs-prose mismatch. |

**gatesPass = false.** Security and Documentation are additionally hard-capped by the approval-gated legal Criticals — no amount of engineering quality lifts them past the gate while ADR-0021 is unapproved.

---

## 4. Remaining blockers

### 4.1 Approval-gated legal Criticals (cannot be engineered closed)
- **R-023** — FTC disclosure for the affiliate-commission majority (ADR-0021 D1, PROPOSED).
- **R-024** — EU/UK Package-Travel/ATOL organizer liability (ADR-0021 D2, three options open; also missing from doc 08's own open-list — NC-8).
- **R-037 (legal half)** — per-jurisdiction money-transmitter/e-money classification for held cashback (ADR-0021 D3; backend hold-gate real, legal exposure open).

### 4.2 Open Criticals whose real fix is parked in PENDING ADR-0021
- **R-021** — VMS counterfactual baseline unchanged in doc 01; reconciliation ≠ baseline fix.
- **R-022** — customer-facing `savings_state` machine exists in no doc; ADR-0014 overclaims closure (NC-6).

### 4.3 New Critical defects introduced/exposed by the remediation
NC-1 unblinded reconciliation panel · NC-2 uncompensated sub-ledger fan-out · NC-3 untrusted-timestamp reversal ordering · NC-4 remediation invisible to execution plan · NC-5 R-081 phantom closure · NC-6 ADR-0014/0021 contradiction · NC-7 scale sim not re-run · NC-8 R-024 omitted from doc 08 · NC-9 portability gate blind to control-plane lock-in.

### 4.4 Partially-closed R1 Criticals
R-009 (canary not per-capability) · R-012 (control-plane lock-in) · R-014 (no ap-south-1 staging; 09-vs-10 contradiction) · R-019 (no CRD deprecation scan) · R-020 (allowlist single shared config).

---

## 5. Scores

- **Architecture Readiness Score: 73 / 100** (from 62; gate 95 — FAIL).
- **Security Readiness Score: 74 / 100** (honest-ceiling-capped).
- **Scalability Readiness Score: 78 / 100** (uncertifiable pending sim re-run).
- **Maintainability Readiness Score: 66 / 100** (execution-plan gap).
- **Documentation Readiness Score: 80 / 100** (gate 98 — FAIL).
- **Final / Residual Risk Score: 55 / 100** (moderate-high; down from R1's SEVERE posture, but 4 open + 5 partial R1 Criticals and 9 new Criticals keep residual risk material).
- **Production Readiness Score: 42 / 100** (from 30; real progress, still not shippable).

---

## 6. P0 recommendation — **NO-GO**

P0 is **NOT authorized.** Round 2 delivered real, verifiable hardening, but the zero-open-Critical gate condition is not met and two dimensions are honest-ceiling-capped. Marking these gates green would be a governance violation.

**Exactly what blocks GO (must all clear):**
1. **Founder/Legal approve ADR-0021** → closes R-023, R-024, R-037(legal), and unblocks the UX half of R-021/R-022. *(Nothing else can lift Security/Documentation past the gate.)*
2. **Fix the three new correctness/fraud Criticals:** NC-1 (blind the panel by design + adversarial distinguishability test), NC-2 (model the conversion→sub-ledger fan-out as a compensating saga or single grouped outbox with a first-class divergence SLI), NC-3 (clamp `network_event_at` to ingest-time bounds + NEXUS-side monotonic tie-break; route out-of-bound postbacks to adjudication).
3. **Close the governance/consistency Criticals:** NC-4 (add ADR-0011–0014/0017 milestones + hard P2 exit gates to doc 10 §12), NC-7 (re-run doc 02 scalability sim against the remediated topology), NC-5 (author R-081's fix or remove the false Closes line), NC-6 & NC-8 (reconcile ADR-0014's header with ADR-0021 D4 and complete doc 08's open-Criticals list).
4. **Discharge the 5 partial Criticals** (R-009/012/014/019/020) to their named residuals.

Re-review as **Round 3** after items 1–3 land. Until then: **BLOCKED.**

*Report path: `docs/review/04-architecture-review-report-v2.md`.*
