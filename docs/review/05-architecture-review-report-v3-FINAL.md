# Architecture Review Report v3 — FINAL (Round 4 Certification)

**Project:** NEXUS Commerce OS
**Review round:** Round 4 (certifying adversarial review)
**Date:** 2026-07-14
**Chair:** Review Board Chair (final certification)
**Verdict:** 🔴 **NO-GO for P0** — 1 open Critical + all five dimension gates below threshold
**Status of doc set reviewed:** docs 01–12 + ADRs 0001–0022 + PROJECT_MEMORY (current state; docs/review/01,03,04 are dated historical R1/R2 records and are *not* treated as current)

---

## 1. Executive Summary

NEXUS has undergone three prior review/remediation rounds and the underlying money-domain
architecture is now genuinely mature: provisional non-payable accrual, purchase-fingerprint
dedup with connector pinning, ledger-per-context to remove the shared-kernel SPOF, per-account
monotonic sequencing, dual-enforced invariants, and the NC-2 *simplification* (one event →
independent idempotent consumers, no distributed-write compensation) are all sound and
consistently specified across the database (06), security (08), and deployment (10) documents.
Eleven of thirteen auditors found **zero open Criticals** in their scope, and independent
content-level verification (not ADR-citation trust) confirms all 24 Round-1 Criticals, all 9
Round-2 new-Criticals, and all 4 legal Criticals (R-021/022/023/024 via ADR-0021 D1–D5) have
real, cross-consistent remediation content in the current docs.

**However, this is a certifying gate, and one genuine, concrete, source-verified open Critical
survives.** Two independent fresh red-team auditors (Fresh Red Team, Fresh Distributed-Systems)
found the same defect: the **NC-3 reversal-ordering fix was never propagated into the primary
System Architecture doc (04 §5.4) or the API Architecture doc (07 §9)**, even though
PROJECT_MEMORY's own Round-3 change log explicitly claims it was "Applied to docs 04/…/10" and
"validated." Both documents still literally specify the pre-fix, attacker-exploitable
`last-writer-by-network-timestamp` ordering that NC-3 existed to eliminate. Because these are the
canonical documents an implementation is built from, and ADR-0022 marks reversal-ordering source
as "safety-critical, not rollback-eligible," shipping the unpatched spec re-opens the forged-postback
resurrection fraud vector (R-003 / R-085 / NC-3).

**The gate rule is dispositive:** `gatesPass` requires all five dimension gates met **and**
`openCriticalsCount == 0`. Neither holds. **P0 is NO-GO.** The good news: the ratified decision
(ADR-0022 NC-3) is correct and the fix text already exists verbatim in docs 06/08/10 — closing the
Critical is a scoped copy-plus-fitness-function edit, not a redesign. But it is not yet done, and a
GO not yet earned is a governance violation.

---

## 2. Review Journey — R1 → R2 → R3 → R4 (score deltas)

| Dimension | R1 | R2 | R3 (mem.) | **R4 (this report)** | Gate | R4 vs gate |
|-----------|----|----|-----------|----------------------|------|------------|
| Architecture | 62 | 73 | — | **88** | ≥95 | ❌ −7 |
| Security | 60 | 74 | — | **88** | ≥95 | ❌ −7 |
| Scalability | 63 | 78 | — | **91** | ≥95 | ❌ −4 |
| Maintainability | 68 | 66 | — | **92** | ≥95 | ❌ −3 |
| Documentation | 85 | 80 | — | **89** | ≥98 | ❌ −9 |
| **Open Criticals** | 20 | 4 open + 9 new | 0 (claimed) | **1 (verified)** | 0 | ❌ |
| Final Risk (0–100, lower=better) | — | — | — | **35** | — | — |

**Trajectory read:** Real, substantial progress across every dimension since R1 — the trend is
genuinely upward and the remediation work is not cosmetic. R4 scores are the highest yet, but the
certifying bar is deliberately higher than "much improved." The single open Critical caps
architecture and security below 95 by rule; scalability and documentation miss for reasons
independent of that Critical (see §4). Round 3 has **no standalone review artifact** parallel to
R1 (00/01) and R2 (03/04) — its "all closed & validated" claim is narrative-only in PROJECT_MEMORY,
and this report is the first to substantiate (and partially falsify) it against source.

---

## 3. Honest Gate Table (evidence per dimension)

| Dimension | Score | Gate | Pass | Evidence anchoring the score |
|-----------|-------|------|------|------------------------------|
| **Architecture** | 88 | ≥95 | ❌ | Design is 95-grade (ledger-per-context, NC-2 simplification, monotonic sequencing all sound and cross-consistent in 06/08/10). Capped below gate by the **open Critical in doc 04 §5.4 (line 166)** — the canonical System Architecture blueprint still specifies the vulnerable `last-writer-by-network-timestamp` reversal rule. An open Critical in the primary architecture doc cannot pass a certifying architecture gate. |
| **Security** | 88 | ≥95 | ❌ | Money-integrity controls (provisional accrual, per-connector auth table, fingerprint dedup, blinded panel) are genuinely strong and correctly carried in doc 08 (line 139). Capped below gate because the same NC-3 gap in docs 04/07 is a **fraud-vector reopening** (forged/replayed postback with crafted `network_event_at` un-reverses a clawed-back accrual), and ADR-0022 marks this source "safety-critical, not rollback-eligible." |
| **Scalability** | 91 | ≥95 | ❌ | **No open Critical.** Egress cells, ledger-per-context write decomposition, and the honest §10 sim re-run are credible. Below gate on three disclosed residual Highs: (a) flash-sale surge (×10–15) breaches NFR-SCAL-01 QPS as early as 10M MAU with no concrete admission-control/pre-warm design; (b) OpenSearch cellularization (load-bearing for the 100M ceiling) is named but not designed to the rigor of the Postgres→distributed-SQL trigger; (c) the 5,000-QPS load-test gate is unexecuted — all figures carry ±50–100% error bars. |
| **Maintainability** | 92 | ≥95 | ❌ | **No dimension-specific open Critical.** Rollback discipline (per-ADR rollback sections, `Rollback PROVEN` CI gate, expand-contract migrations) and active *simplification* (NC-2 removed a saga layer) are real strengths. Below gate because the propagation discipline the project mandates (Prime Directive #4) **demonstrably failed** for docs 04/07 and was falsely logged as validated; plus no standalone Round-3 artifact, no ADR-dependency/lineage map for a 22-ADR corpus, and a self-flagged two-IaC-tool cognitive tax. |
| **Documentation** | 89 | ≥98 | ❌ | **No business/legal-blocking contradiction**, but the ≥98 "near-zero contradictions" bar is not met. Verified defects: the doc 04/07-vs-ADR-0022/06/08 reversal-ordering contradiction (a *safety-critical* contradiction, the most severe); stale single-ledger diagram box in doc 08 §1.1; ≥6 dangling/inconsistent anchor slugs (SDD §4.3, `#6-technology-stack…`, `#9-failure…`); savings four-state vocabulary drift (ADR-0014/06 vs ADR-0021/11/12); reused "Checkout" label in doc 09; all ten docs still headed "Status: 🟡 Draft v1" against PROJECT_MEMORY's "Draft-complete." |

**`gatesPass` = FALSE.** Five of five dimension gates are below threshold, and `openCriticalsCount = 1`.

---

## 4. Open Items

### 4.1 Open Critical (1 — deduped from 2 auditors, single root cause)

**C-1 — NC-3 reversal-ordering fix never propagated to docs 04 §5.4 and 07 §9 (attacker-controllable ordering key still specified in the canonical build documents).**

- **Objective evidence (verified against source this round):**
  - `docs/04-system-architecture.md:166` reads verbatim: *"…`pending → confirmed → reversed`, **last-writer-by-network-timestamp** with reversal always winning…"*
  - `docs/07-api-architecture.md:519` reads verbatim: *"…the state machine is `pending → confirmed → reversed` (**last-writer-by-network-timestamp**, reversal always wins)…"*
  - The **fix exists and is correct elsewhere**: `ADR-0022` NC-3 — *"keys on NEXUS's own monotonic receipt sequence + a signed reconciliation decision, never on the attacker-suppliable `network_event_at`"*; `docs/06-database-architecture.md:526` — *"network timestamp; advisory only — NOT the ordering basis (ADR-0022)"*; `docs/08-security-architecture.md:139` — *"reversal ordering is NEXUS-authoritative… never the attacker-suppliable `network_event_at`"*; `docs/10-deployment-architecture.md:968`.
  - **Aggravating:** doc 08 line 140 cross-links `[04 §5.4]` as the ledger authority — following doc 08's own reference lands a reader on the vulnerable spec. PROJECT_MEMORY line 139 explicitly claims ADR-0022 was *"Applied to docs 04/05/06/08/09/10… All 9 NC + 5 partials closed & validated… NEXUS-seq reversal"* — **that validation claim is false for docs 04 and 07.**
- **Failure scenario:** an engineer/agent implementing the postback state machine from doc 04 (canonical System Architecture) or doc 07 (API ingest contract) builds `last-writer-by-network-timestamp` ordering. Postbacks are weakly authenticated plain GETs (doc 08). An attacker replays/forges a "confirm" postback whose `network_event_at` is stamped later than a legitimate prior "reversed" entry; under the last-writer-by-timestamp rule the forged confirm wins and **un-reverses a clawed-back conversion**, resurrecting payable commission on a returned/chargebacked purchase — exactly the R-003/R-085/NC-3 forged-postback-drain the review process exists to close. ADR-0022 marks this source "safety-critical, not rollback-eligible," so shipping the wrong version is a severe, direct financial-fraud reopening.
- **Severity:** Critical (money-integrity / fraud). **Remediation effort: low** — copy the ratified wording from doc 08 §139 / doc 06 §526 into doc 04 §5.4 and doc 07 §9; add a CI fitness function asserting NEXUS-sequence-over-`network_event_at` ordering (doc 04 §10's fitness list at lines 298–316 currently has no such test); and correct PROJECT_MEMORY's false "validated" change-log entry.
- **Auditors:** Fresh Red Team; Fresh Distributed-Systems (independent, same root cause → counted once).

### 4.2 Notable Highs (selected — full set carried in the risk register)

| # | High | Evidence | Owner |
|---|------|----------|-------|
| H-1 | Flash-sale surge (×10–15) breaches NFR-SCAL-01 QPS at ≥10M MAU with no concrete admission-control/load-shed/pre-warm design | sim §G5b; docs 04/09/10 have only "surge headroom + shed-to-cache is mandatory" prose | Scalability |
| H-2 | OpenSearch cellularization (load-bearing for 100M ceiling) named but not designed to the Postgres→distributed-SQL trigger's rigor | doc 06 §6 (pools/sharding only, no multi-cluster topology/trigger metric) | Scalability |
| H-3 | 5,000-QPS ≤400ms load-test gate unexecuted; all sim figures ±50–100% modeled, not measured | sim §9; doc 09 §7 | Scalability |
| H-4 | `exactly-once` relay mislabel in 3 canonical spots contradicts the correct at-least-once + dedup prose in the same docs; an implementer keying off it could skip consumer dedup → double-accrual on redelivery | doc 04 lines 109/133, doc 08 §8.2 line 477 vs doc 04 §5.4/§7.1, doc 06 §3.6 | Distributed-Systems |
| H-5 | No cross-domain GL divergence-SLI / bounded-staleness SLA distinct from generic consumer-lag/DLQ | doc 06 §9 | Distributed-Systems |
| H-6 | Reconciliation panel blinding asserted only as a schema comment; no panel-rotation/population-diversity spec → resourced counterparty can behaviorally fingerprint and selectively fully-report | docs 04/06/08 | Red Team |
| H-7 | Fingerprint dedup uses static amount/time buckets; a colluding connector pair can perturb across bucket boundaries → double commission on one physical sale | doc 06 line 518; ADR-0012 (probabilistic, no anti-gaming control) | Red Team |
| H-8 | Connector sandbox (ADR-0018) not committed to a hardened runtime (gVisor/Kata/microVM) vs ordinary namespaces; credentialed 3rd-party code on hostile data | ADR-0018 | Red Team |
| H-9 | Stale single-ledger diagram box `LEDGER[Ledger & Payouts]` in doc 08 §1.1 contradicts ADR-0013 ledger-per-context | doc 08 line 52 | Documentation |
| H-10 | ≥6 dangling/inconsistent cross-doc anchors (SDD §4.3, `#6-technology-stack…`, `#9-failure…`) | docs 05/06/10, ADR-0005 | Documentation |
| H-11 | Savings four-state vocabulary drift: "promised/clawed-back" (ADR-0014/06) vs "Estimated/Reversed" (ADR-0021/11/12); ADR-0014 §4 never corrected | ADR-0014; docs 11 §2, 12 §5 | Product-Truth/Doc |
| H-12 | All 10 docs headed "Status: 🟡 Draft v1" vs PROJECT_MEMORY "Draft-complete" | docs 01–10 headers | Documentation |
| H-13 | Stale ADR metadata: ADR-0012 body still reads pre-fix "last-writer-by-network-timestamp"; ADR-0015/0014 "Closes" lines overstate scope (R-081/R-022) | ADR-0012 §item-3, ADR-0014/0015 headers | Security/FinOps/Honesty |
| H-14 | Fixed-cost floor +25–40% worse at 10K–100K scale from money-integrity remediation (honestly disclosed; monitor burn-vs-milestone at P1/P2) | docs/review/02 §10 | Maintainability |
| H-15 | No standalone Round-3 review artifact; no ADR-dependency/lineage map for 22 ADRs | PROJECT_MEMORY narrative-only | Maintainability |

---

## 5. Scores

- **Dimension readiness:** Architecture 88 · Security 88 · Scalability 91 · Maintainability 92 · Documentation 89
- **Architecture Readiness Score (mean of 5 dimensions):** **90** (89.6)
- **Production Readiness Score:** **84** — high remediation maturity, but blocked by one open safety-critical and five sub-gate dimensions
- **Final Risk Score (0–100, lower = better):** **35** — one open Critical whose *impact* is severe (financial-fraud reopening) but whose *remediation* is a scoped, already-authored fix; plus a bounded set of disclosed Highs. Not SEVERE (R1 was 432 on the register scale), not clear (would be ~15 at zero Criticals).

---

## 6. P0 Recommendation

### 🔴 NO-GO

**GO is not authorizable.** The certification rule requires all five gates met **and** zero open
Criticals; **zero of five gates are met and one open Critical is verified.**

**Exactly what blocks GO (objective evidence, not vibes):**

1. **[BLOCKER — Critical C-1]** Docs 04 §5.4 (line 166) and 07 §9 (line 519) specify the
   attacker-controllable `last-writer-by-network-timestamp` reversal rule that ADR-0022 NC-3
   eliminated; the correct fix exists in docs 06/08/10 but was not propagated, and PROJECT_MEMORY's
   "validated" claim is false. → **openCriticalsCount = 1.**
2. **[GATE]** Architecture 88 < 95, Security 88 < 95 (both capped by C-1).
3. **[GATE]** Scalability 91 < 95 — flash-sale surge undesigned (H-1), OpenSearch cellularization
   undesigned (H-2), load-test gate unexecuted (H-3). Independent of C-1.
4. **[GATE]** Maintainability 92 < 95 — demonstrated propagation-validation failure + no R3
   artifact / no ADR lineage map (H-15).
5. **[GATE]** Documentation 89 < 98 — the C-1 contradiction plus H-9/H-10/H-11/H-12 (six-plus
   verified consistency defects) put the doc set well short of "near-zero contradictions."

**Path to GO (scoped, verifiable):**
- Close C-1: propagate ADR-0022 NC-3 wording into doc 04 §5.4 + doc 07 §9; add a CI fitness
  function asserting NEXUS-sequence ordering; correct the false PROJECT_MEMORY change-log entry.
  (Then re-verify → openCriticalsCount → 0; Architecture/Security → ≥95.)
- Execute the 5,000-QPS load-test gate; design flash-sale admission control and OpenSearch
  cellularization to trigger-metric rigor. (Scalability → ≥95.)
- Produce a standalone Round-3/4 review + risk-register artifact; add an ADR lineage map.
  (Maintainability → ≥95.)
- Fix H-9/H-10/H-11/H-12 and the `exactly-once` mislabel (H-4); flip stale doc headers.
  (Documentation → ≥98.)

Once all four are done and re-verified against source, a Round-5 confirming pass can honestly
authorize P0.

---

*Prepared by the Review Board Chair. All findings in §3–§4 were verified against current document
text (docs 04/06/07/08/10 + ADR-0012/0022 + PROJECT_MEMORY), not ADR citations or change-log prose.*
