# 03 — Master Risk Register v2 (Ultra Adversarial Review, Round 2)

**Status:** 🔴 Gate-blocking · **Owner:** Review Board Chair · **Date:** 2026-07-14
**Basis:** Round-1 register ([01-master-risk-register.md](01-master-risk-register.md)) + remediation ADRs 0011–0021 woven into docs 01–10, re-attacked by 16 verify/attack auditors.
**Rule applied:** R-023 & R-024 are **Critical, legal, approval-gated** → they remain **OPEN** regardless of engineering quality (per the PROJECT_MEMORY honest-ceiling). A partially-closed Critical is **not** counted as closed.

> **Verdict:** Round 2 does **NOT** pass the ratification gates. Substantial, genuine remediation landed (15 of 24 R1 Criticals fully closed with concrete, cross-consistent mechanisms), but **4 R1 Criticals remain fully open, 5 are only partially closed, and the remediation pass itself introduced/exposed 9 new Critical-level defects**. P0 stays BLOCKED.

---

## 1. Counts

### 1.1 R1 Criticals (the 24 items marked Critical in R1 §2; R1 §1.1 summarised these as "20")

| Bucket | Count | R-IDs |
|---|---|---|
| **Fully closed** (verified mechanism, not just a citation) | **15** | R-001, R-002, R-003, R-004, R-005, R-006, R-007, R-008, R-010, R-011, R-013, R-015, R-016, R-017, R-018 |
| **Partially closed** (core addressed; a named sub-scenario the finding raised is still open) | **5** | R-009, R-012, R-014, R-019, R-020 |
| **Open** (real fix parked in PENDING ADR-0021, or approval-gated) | **4** | R-021, R-022, R-023, R-024 |

> Note: R1 itself is internally inconsistent — §1.1 says "20 Critical" while the §2 ranked table marks R-001…R-024 (24 rows) as Critical. This register uses the explicit per-row severity (24) and reports status by R-ID so the gate math is unambiguous.

### 1.2 R1 Highs (34)

| Bucket | Approx. count | Notes |
|---|---|---|
| **Fully closed** | ~18 | e.g. R-026/027/028, R-029, R-033, R-036, R-038–045, R-048/049, R-051, R-053/054, R-055/056/057, R-058, R-060/061/062/063/064, R-065/066/067/068, R-071, R-073, R-077, R-078, R-080, R-082/083, R-084/085 |
| **Partially closed / contested** | ~15 | R-030, R-031, R-032, R-034, R-035, R-037, R-050, R-052, R-059, R-069, R-070, R-074, R-075, R-076, R-079 |
| **Falsely claimed closed (phantom)** | 1 | R-081 (ADR-0015 "Closes" line lists it; zero corresponding content anywhere) |

### 1.3 Net gate math

- R1 Criticals **not fully closed: 9** (4 open + 5 partial).
- **New Critical-level defects surfaced in Round 2: 9** (see §4).
- Total Critical-severity open items feeding the gate: **18**.
- **Zero-open-Critical gate condition is NOT met.**

---

## 2. What genuinely closed since R1 (highlights)

The remediation is real, not cosmetic. Verified mechanisms (present in doc bodies, cross-consistent across 04/06/07/08/09, not merely referenced):

- **R-001/002/003/033/084/085 — Revenue integrity.** `CLICKOUT_LEDGER`, `RECON_RUN`, `ATTRIBUTION_GAP`, `purchase_fingerprint`, `pinned_connector`, and a `payable` boolean make postback-derived accrual provisional/non-payable by construction; per-connector auth table replaces blanket signature-trust; archival retention tied to the longest network reversal window; idempotent order-independent confirm/reverse state machine. (ADR-0011/0012)
- **R-004/069 — Ledger shared-kernel SPOF.** Per-context sub-ledgers + async GL; dual-enforced money invariant; PDP HA. (ADR-0013)
- **R-005 — Cashback hold-gate.** `held_cash`/`available` wallet split; payout draws only from `available`. (ADR-0014)
- **R-006/007/011/048/049/051/053/054/055/056/057 — AI trust/cost.** Deterministic price verify (integer minor-units canonical money type code-generated into 3 runtimes), protected grounding budget, drift canary wired to rollback, claim-span cache re-verification, stratified/power-reported eval, quality-gated degrade, per-escalation injection re-scan. (ADR-0015/0020)
- **R-010/013/015/036/073/075/076 — Region/residency.** Classifier-enforced residency fence at the Gateway hop; in-zone DR pairs; erasure saga reaches affiliate networks and drops post-erasure postbacks; per-user DEK crypto-shred; network-layer default-deny. (ADR-0016)
- **R-016/017/065/066/067/068/071 — Connector/supply-chain.** Out-of-process sandboxed connector workers; per-merchant canonical-destination redirect allowlist; ephemeral OIDC CI runners; step-up + cooldown + mandate-revocation on ATO/payout-destination change. (ADR-0018)
- **R-008/020/029/060/078/082/079/080/083 — Scale/SPOF/perf.** Singleflight coalescing; cellular egress; discovery/money pool split; observability off the critical path; GPU warm floor; Redis isolation; parallel fan-out; composite hot-partition key; parent/child price split. (ADR-0017/0020)
- **R-018/058/061/062/063/064/077 — Ops maturity.** GitOps break-glass carve-out; flaky-quarantine vs AI-eval reconciliation; region bring-up warm-up; gray-failure connector testing; rollback-PROVEN gate; ClickHouse operator/quorum. (ADR-0019)

---

## 3. R1 Criticals & key Highs still OPEN or PARTIAL (with why)

### 3.1 Open Criticals (gate-blocking)

| ID | Status | Why not closed |
|----|--------|----------------|
| **R-021** | OPEN | VMS root cause (self-chosen, self-audited counterfactual baseline) is **untouched** — `docs/01-vision.md` line 56 still defines VMS verbatim. ADR-0011 reconciliation validates *reported* conversions, not the flattering "default merchant" baseline. R1's own report attributes the real fix to **ADR-0021 (PENDING)**. |
| **R-022** | OPEN | Only the money-side plumbing shipped (ADR-0014 held/available). The user-facing `savings_state` (estimated/pending/confirmed/reversed) machine — the actual finding — exists in **no doc**. Fix parked in ADR-0021 D4 (PENDING). ADR-0014's header **overclaims** closure (see NC-6). |
| **R-023** | OPEN (approval-gated) | FTC affiliate-commission disclosure copy + agent verbalization unwritten/unapproved; ADR-0021 D1 is Status PROPOSED, "does NOT count toward gate closure." |
| **R-024** | OPEN (approval-gated) | EU/UK Package-Travel/ATOL organizer-liability decision unmade (ADR-0021 D2, three options open). Worse: **absent from doc 08's own open-Criticals bookkeeping** (see NC-8). |

### 3.2 Partially-closed R1 Criticals (core done, named residual open)

| ID | Closed half | Residual (still open) |
|----|-------------|-----------------------|
| **R-009** | AI routing-policy is versioned + canaried **per region** | Not split **per capability (C1–C9)**; a bad delta still degrades all 9 capabilities in the cohort, violating 05 §1's own principle. |
| **R-012** | CI portability lint on un-abstracted **SDK** use | Structurally blind to Terraform control-plane lock-in (IRSA, Global Accelerator, Route 53, Shield, Control Tower). Escalated to a **new Critical** (NC-9). |
| **R-014** | Region-before-market gate (gate diagram, gantt, default-deny) | "Staging single-region" root cause unfixed; **09 §12 vs 10 §4 contradict** on staging topology; **no staging tier for ap-south-1** (the BD/IN market R-014 was about). |
| **R-019** | Blue-green node groups, pinned CNI/CoreDNS/CSI, tested skew rollback | No pre-upgrade **CRD/API deprecation scanner** (kubent/pluto) for Istio/Argo Rollouts/Kyverno — the specific failure R-019 named. |
| **R-020** | Throughput/availability via horizontally-scaled egress cells | Allowlist stays **one shared config**; a bad edit still fans out to all cells instantly (no canary, unlike R-009's treatment). |

### 3.3 Key Highs still open / partial / contested

R-030 (program/price-snapshot not frozen by pin), R-031 (kill-switch orphans in-flight referrals; 04 §6.1 still says "disabled instantly"), R-032 (`capabilities()` omits attribution-asymmetry fields), R-034 (non-portable deferred-constraint trigger vs CRDB/YB), R-035 (outbox loss-on-failover, not duplication, unaddressed), R-037 (money-transmitter/e-money legal, OPEN by docs' own admission), R-050 ($0.01 ceiling reasserted unchanged despite acknowledging real cost "multiples higher"), R-052 (`review.*` topics referenced in 05 but absent from 06 canonical registry), R-059 (same-cluster node pools, shared control plane — not separate clusters), R-069 (dual invariant-checker never architecturally specified; contested vs "closed"), R-070 ("NEXUS-verified" capabilities asserted, mechanism unspecified), R-074 (circular residency fix, no refuse-vs-quarantine decision), R-075 (coordination ledger real, coverage-guarantee/CI registry missing), R-076 (pre-erasure backups can still resurrect PII), R-079 (serial-chain fixed, N+1-per-candidate fan-out unaddressed), **R-081 (phantom closure — see §1.2)**.

---

## 4. NEW Critical-level findings from the Round-2 attack pass (ranked)

| # | Finding | Cat | By |
|---|---------|-----|----|
| **NC-1** | **Reconciliation panel is not blinded from the networks it audits** — seeded/opt-in panel traffic is recognizable, so a network can grade its own homework (Volkswagen defeat-device pattern). Produces a *documented, numeric false-confidence* in VMS — arguably worse than R-001's acknowledged unknown. | fraud-vector | Fresh Red Team |
| **NC-2** | **Single conversion fans out to ≤3 sub-ledgers (affiliate/cashback/creator) with no compensation for partial fan-out failure.** ADR-0013 decoupled the ledgers but the event that must reach all of them atomically has no saga/compensation; the reporting-only GL is not a correctness backstop. Reintroduces R-004's cross-domain corruption one layer up. | distributed-txn | Fresh Distributed-Systems |
| **NC-3** | **Reversal-wins ordering keys on `network_event_at` — an untrusted, network-supplied timestamp.** A forged/backdated "confirm" can win the last-writer race against a legitimate "reverse," resurrecting a clawed-back conversion. Reopens R-003/R-085 via the field the fix introduced as arbiter of truth. | correctness-security | Fresh Distributed-Systems |
| **NC-4** | **Money-integrity ADRs 0011–0014 and blast-radius ADR-0017 are invisible to the execution plan.** Grep-verified: doc 10 §12 (build plan / exit gates / Gantt) contains **zero** references to these ADRs; its own consistency note omits them. P2 exit criteria never require the reconciliation SLI, fingerprint dedup, sub-ledger invariant, or payout hold-gate to be live — a team can pass every written gate while shipping the pre-remediation auto-credit design. Violates Prime Directive #4. | process-governance | Fresh CTO |
| **NC-5** | **ADR-0015 phantom-closes R-081.** Its "Closes" line and PROJECT_MEMORY list R-081, but none of its 9 decision points (nor 05/09/02) contain any cache-hit-rate floor, 0%-hit cost model, or pre-warming. Inflates the remediation count and hides an open High cost/latency risk. | doc-integrity | AI Trust/Cost |
| **NC-6** | **ADR-0014 vs ADR-0021 contradict on whether R-022 is closed.** ADR-0014 header: "Closes: … R-022"; ADR-0021 D4: R-022 "remain[s] OPEN … until approved." Two remediation ADRs reach opposite conclusions on the same finding; no doc reconciles them. | adr-vs-adr | Doc-Consistency |
| **NC-7** | **The scalability simulation (doc 02-review) was never re-run against any remediation.** Grep-verified zero references to ADR-0011–0021; cost/bottleneck tables are pre-remediation figures. The board is asked to certify the scale gate against numbers computed for the old topology — the central Round-2 question is unanswerable from the cited evidence. | evidence-gap | Scalability Re-Modeler |
| **NC-8** | **R-024 silently missing from doc 08's own OPEN-Criticals lists** (§9.1 Travel row, §12.1, §12.2 caveat list only R-023 + R-037). A reader scoring off 08's honest-ceiling tables counts 2 open Criticals instead of 3 — score-inflation-by-omission in the very artifact meant to prevent it. | doc-honesty | Honesty Auditor |
| **NC-9** | **Portability CI gate structurally cannot see Terraform control-plane lock-in** (IRSA / Global Accelerator / Route 53 / Shield / Control Tower). The exact subsystems R-012 named as unabstracted remain untested and unlisted as accepted lock-in; "multi-cloud-capable" is still unproven for the routing/identity plane. | vendor-lock-in | Portability/Ops |

### 4.1 Notable new High findings (not exhaustive)

Reversal path inherits weak confirm-path auth (Revenue-Integrity); `review.*` topics missing from 06 registry (AI Trust/Cost); $0.01 ceiling reasserted despite acknowledged overrun (AI Trust/Cost); staging residency 09-vs-10 contradiction + no ap-south-1 staging (Multi-Region); money/auth Redis consolidation now couples ledger idempotency (SPOF); discovery/money isolation is same-cluster node-pools not separate clusters (SPOF); connector sandbox has no per-connector network-egress policy (Security/Supply-Chain); EKS upgrade has no CRD deprecation scan (Portability/Ops); purchase-fingerprint dedup is a griefing/DoS primitive (Red Team); hold/adjudication queue is an unscoped privileged surface — no RBAC/dual-control/SLA (Red Team); ADR-0011 rollback runbook, read literally, reopens R-003 (Red Team); connector pinning orphans postbacks on failover (Distributed-Systems); reconciliation GL has no lag SLO unlike every sibling projection (Distributed-Systems); ADR-0004 stale/self-contradicting (CTO); dual-invariant has no anti-drift mechanism (CTO); canonical money-type violated by literal ClickHouse `Decimal`/OpenSearch `scaled_float` schemas in 06 (Doc-Consistency); blast-radius splits double the HA fixed-cost floor uncosted (Scalability Re-Modeler); egress-cell shared-allowlist-policy node may be a per-call chokepoint (Scalability Re-Modeler).

---

## 5. Readiness scoring & gate result (Round 2)

| Dimension | R1 | R2 | Gate | Pass? | Rationale |
|-----------|----|----|------|-------|-----------|
| Architecture | 62 | **73** | ≥95 | ❌ | R-004/005 genuinely closed; but NC-2 (sub-ledger fan-out) and NC-3 (untrusted-timestamp ordering) are new Criticals in-dimension, and R-034/035/069 residuals persist. |
| Security | 60 | **74** | ≥95 | ❌ | Strong supply-chain/postback remediation, but **honest ceiling applies (R-023/024 open)** and NC-1 (unblinded audit panel) is a new Critical fraud vector; reversal-path/fingerprint-griefing residuals. |
| Scalability | 63 | **78** | ≥95 | ❌ | Real, sound mechanisms (singleflight, cells, pool/Redis splits, GPU floor); but **NC-7 (sim never re-run)** means the gate cannot be certified with numbers, and R-009/014/020 partials remain. |
| Maintainability | 68 | **66** | ≥95 | ❌ | Per-doc content stronger (contract-first, CI fitness functions), but **NC-4 (remediation absent from the execution plan)** is a maintainability-Critical worse than what it fixed; stale ADR-0004; dual-invariant lockstep burden. |
| Documentation | 85 | **80** | ≥98 | ❌ | 66 Mermaid valid, ADR citations mostly coherent; but genuine contradictions found: **NC-6 (ADR-0014 vs 0021), NC-5 (R-081 phantom), NC-8 (R-024 omission), money-type schema-vs-prose mismatch.** Honest ceiling (R-023/024) also caps this. |

**gatesPass = false.** No dimension reaches its gate; two dimensions (security, documentation) are additionally hard-capped by the approval-gated legal Criticals.

---

## 6. Path to green (Round-2 sequenced)

1. **Approvals (unblocks 2 dimensions):** Founder/Legal decision on ADR-0021 D1/D2/D4 → closes R-023, R-024, and the UX half of R-021/R-022.
2. **Correctness Criticals:** NC-2 (fan-out saga/compensation), NC-3 (clamp `network_event_at` + monotonic tie-break), NC-1 (blind the reconciliation panel).
3. **Governance Criticals:** NC-4 (add ADR-0011–0014/0017 milestones + hard exit gates to doc 10 §12), NC-7 (re-run doc 02 sim against the new topology), NC-5 (author R-081 fix or drop the false Closes line), NC-6/NC-8 (reconcile ADR-0014 header + doc 08 open-list bookkeeping).
4. **Partial-Critical residuals:** R-009 (per-capability canary), R-012/NC-9 (Terraform OPA/Conftest lock-in gate), R-014 (ap-south-1 staging + reconcile 09/10), R-019 (kubent/pluto gate), R-020 (canary the allowlist).
5. **High cluster:** R-030/031/032/034/035/037/050/052/059/069/070/074/075/076/079 + the new Highs in §4.1.

*Register path: `docs/review/03-master-risk-register-v2.md`. Companion report: `docs/review/04-architecture-review-report-v2.md`.*
