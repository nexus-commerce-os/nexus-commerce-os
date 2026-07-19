# Architecture Review Report v4 — FINAL (Round 5 Certification)

- **Project:** NEXUS Commerce OS (`NEXUS`)
- **Phase:** PHASE 0 — Documentation & Architecture
- **Round:** 5 (certifying)
- **Date:** 2026-07-14
- **Chair:** Review Board (final certification)
- **Method:** Every claim verified **directly against current source text** in `docs/`, not against ADR citations, PROJECT_MEMORY change-log entries, or reviewer summaries. `docs/review/00–05` treated as dated historical artifacts.

---

## 1. Executive Summary

**Verdict: NO-GO.** P0 (build) is **not** authorized.

Round 5 delivered a **genuine, source-verified fix** to the single Round-4 blocking Critical (C-1). The attacker-controllable `last-writer-by-network-timestamp` reversal rule is **gone from every document** in `docs/`; docs 04 §5.4 (line 166), 06 §3.8 (line 548), and 08 (line 139) all now key confirm/reverse ordering on **NEXUS's own monotonic receipt sequence + a signed reconciliation decision**, and doc 04 §10 (line 313) adds a **concrete adversarial CI fitness function** that replays a forged confirm and asserts it cannot un-reverse a corroborated reversal. This is real, durable, enforceable closure — the money-integrity spine is sound.

However, the certification cannot pass. **Two open Criticals** survive against source, **five of five dimension gates fail**, and — most concerning for process integrity — the Round-5 remediation **repeated the exact defect class that caused the Round-4 NO-GO**: fixes written into ADRs (H-6/H-7/H-8) were **never propagated into the canonical docs (04/06/08)** engineers build from. A round that prided itself on catching "ADR says X, doc still says Y" reintroduced that same gap on three security Highs.

| Metric | Value |
|--------|-------|
| Open Criticals (true, de-duped) | **2** |
| Gates passing | **0 of 6** |
| Architecture Readiness (mean of 5) | **89** |
| Production Readiness | **80** |
| Final Risk Score (0–100, lower=better) | **34** |
| P0 Recommendation | **NO-GO** |

---

## 2. Round-by-Round Score Delta (R1 → R5)

| Dimension | Gate | R1 | R2 | R4 | **R5 (final)** | Δ R4→R5 | Pass? |
|-----------|------|----|----|----|----|---------|-------|
| Architecture | ≥95 | 62 | 73 | 88 | **90** | +2 | ❌ |
| Security | ≥95 | 60 | 74 | 88 | **84** | −4 | ❌ |
| Scalability | ≥95 | 63 | 78 | 91 | **92** | +1 | ❌ |
| Maintainability | ≥95 | 68 | 66 | 92 | **90** | −2 | ❌ |
| Documentation | ≥98 | 85 | 80 | 89 | **87** | −2 | ❌ |
| **Open Criticals** | 0 | 20 | 13 | 1 | **2** | +1 | ❌ |

**Why security and documentation regressed vs. R4:** these are not new defects appearing — they are the honest result of **verifying the R5 remediation claims against source** and finding them unmet. R5 claimed H-6/7/8 "addressed"; they were addressed only in ADR text. Scoring the claimed-but-unpropagated state as "closed" would be inflation, so the dimensions are marked down to their true state.

---

## 3. Gate Table — Honest, Per-Dimension Evidence

| Dimension | Score | Gate | Pass | Evidence (source-verified) |
|-----------|-------|------|------|----------------------------|
| **Architecture** | 90 | ≥95 | ❌ | C-1 genuinely closed (04:166, 06:548, 08:139; CI gate 04:313). **Blocked by open Critical E:** doc 06 §3.7 `CONVERSION` entity (lines 470–477) has **no `network` column** and a **bare single-column `network_txn_id UK`**, contradicting the `(network, txn_id)` composite that ADR-0012 mandates and that §3.8 `ATTRIBUTED_CONVERSION` (line 517) correctly encodes. An open Critical in the data-model architecture cannot clear a certifying gate. |
| **Security** | 84 | ≥95 | ❌ | Zero security Criticals; C-1, wallet hold-gate, provisional accrual, per-connector auth table, ATO/open-redirect all verified present. **Capped by three verified High propagation gaps (H-6/7/8):** `gVisor/Kata/microVM` appears **only** in ADR-0018:10 — docs 04:196 and 08:374 still say "separate process/container"; panel **rotation/population-diversity** (ADR-0022 NC-1) is **absent** from docs, only "blinded" reached 06:441/482; bucket **jitter + connector-pair collusion signals** (ADR-0012:13) appear in **no** body doc. Confirm-gate "independence" is also weaker than advertised (2 of 3 legs network-sourced). |
| **Scalability** | 92 | ≥95 | ❌ | Zero scalability Criticals. Surge admission + priority load-shed (09 §7.1, lines 367–378), OpenSearch cellularization trigger (06 §6.1), and 5,000-QPS load-test-as-gate (09:362, 10) are concrete and cross-referenced. Below gate because designs are **unexecuted** (P1/P2 gates modeled, not run — honestly disclosed) and the **sub-1M AI-cost floor** is disclosed only in the sim (02 §5.4:179), not propagated into docs 05/09/03 body; **R-025 remains open** across all remediation ADRs. |
| **Maintainability** | 90 | ≥95 | ❌ | ADR-INDEX-lineage.md accurate and load-bearing; C-1 fix is durable (prose + CI gate). Below gate because the **propagation-QA gap is systemic**: H-6/7/8 ADR→doc drift, ADR-0013:15 still says "exactly-once" where docs correctly say effectively-once, and doc 06:352 stale vocab all point to the same missing lint/consistency control. |
| **Documentation** | 87 | ≥98 | ❌ | C-1 removed everywhere; 4 of 6 R4 doc defects genuinely fixed. **Blocked by open Critical A** (06:352 stale savings vocabulary) plus **13+ dangling anchors** (e.g. 10:859 → `#43-price-drop-watch--auto-buy`, dead and reintroducing retired "auto-buy" term; the `#7-cross-cutting-resilience-patterns` slug used across 06/07/09/10 does not exist — doc 04 §7 is "Cross-cutting concerns"), and **doc 07 carries zero `disclosure` field** (grep count 0) though 05/08/11 assert the API contract MUST carry it. Nowhere near the ≥98 near-zero-defect gate. |

---

## 4. Open Criticals (2) — Exact Reasons + Objective Evidence

### C-A — Stale/contradictory savings-state vocabulary in a foundational, legally-load-bearing doc
- **Location:** `docs/06-database-architecture.md:352` (§3.5 Payout hold-gate).
- **Verbatim (verified):** *"The product surfaces **promised / pending / confirmed / clawed-back** states explicitly (R-022)."*
- **Contradicts:** the Founder-ratified four-state model **Estimated → Pending → Confirmed → Reversed** (ADR-0021 D4, ADR-0014 §4, and the normative Product-Guidelines table 11 §2; also 01 §4, 03 §2/§7, 05 §3.5/§7.5, 08 §8.3 twice, 12 §5).
- **Why Critical:** doc 06 is the authoritative schema/domain-model source, marked "R4-remediated," yet still carries pre-ADR-0021 terminology on an **FTC-disclosure surface** (savings honesty). It is a **live contradiction of a ratified legal-compliance requirement** and the **identical propagation-failure class** that produced Round-4's NO-GO on C-1, recurring in a different document.
- **Failure scenario:** an engineer/auditor building the wallet/cashback presentation layer off doc 06 names customer-facing enum/labels "promised/clawed-back" instead of the ratified "Estimated/Reversed," breaching the "disclosure copy MUST be consistent across all surfaces" requirement (11 §1) and resurfacing the R-022 UX-honesty gap the ADRs claim closed.
- **Fix:** replace the four words with "Estimated / Pending / Confirmed / Reversed"; add a CI lint banning legacy synonyms ("promised", "clawed-back", "guaranteed").

### C-B — `CONVERSION` entity violates the `(network, txn_id)` idempotency invariant it is designated to implement
- **Location:** `docs/06-database-architecture.md:470–477` (§3.7 `CONVERSION`).
- **Verified schema:** `conversion_id PK`, `attribution_id FK`, `referral_id`, `commission`, `currency`, `network_txn_id UK` — **no `network` column; single-column unique key.**
- **Contradicts:** ADR-0012 §3 (idempotency on composite `(network, txn_id)`) and the sibling §3.8 `ATTRIBUTED_CONVERSION` (line 517: `network` + `network_txn_id "idempotency: UK(network, network_txn_id)"`). Doc prose is consistent everywhere else (04:166, 06:1137, 08) that the key is composite — §3.7 is the lone dissenter, and `CONVERSION` is money-triggering (line 480: it emits the `conversion.confirmed` event each sub-ledger consumes).
- **Why Critical:** affiliate networks assign txn_ids in **independent id-spaces** (Amazon batch vs CJ vs Impact vs Rakuten). A shared `network_txn_id` string across two networks either (a) throws a unique-constraint violation and **silently drops a legitimate confirmed conversion** — lost commission/creator earnings that the reconciliation SLI cannot catch because the loss originates **inside NEXUS's own schema**, not network under-reporting — or (b) if uniqueness isn't enforced, **silently conflates two distinct conversions'** commission/attribution. Direct money-correctness defect in the exact subsystem this round certifies as fixed.
- **Fix:** add `network` to `CONVERSION` and change the constraint to `UK(network, network_txn_id)`; and add an explicit SoR statement resolving the CONVERSION vs ATTRIBUTED_CONVERSION redundancy (see H-9 below) so the CI reversal-ordering gate has an unambiguous target table.

---

## 5. Gate-Blocking / High-Severity Residuals (verified, non-Critical)

| # | Severity | Item | Evidence |
|---|----------|------|----------|
| H-8 | High (Sec) | Hardened connector runtime not propagated | `gVisor/Kata/microVM` only in ADR-0018:10; docs 04:196, 08:374 say "separate process/container"; CI gate 04 §10 tests out-of-process, not runtime hardening. Container-escape CVE → host pivot remains the un-closed R-017 scenario. |
| H-6 | High (Sec) | Panel rotation/population-diversity not propagated | ADR-0022 NC-1 full language; doc 06:441/482 carries only "blinded"; docs 04/08 have neither. A static panel is behaviorally fingerprintable → selective full-reporting defeats under-reporting detection. |
| H-7 | High (Sec) | Fingerprint anti-gaming (jitter + collusion signal) not propagated | ADR-0012:13 full language; no jitter/overlapping-bucket/connector-pair-collusion wording in 04/06/08 body. Colliding connector pair can nudge amount/time across static bucket edges → double-claim one physical sale. |
| H-9 | High (Arch) | Single postback/reversal fact modeled in 3 schemas without a SoR statement | ATTRIBUTION_STATE (§3.7), ATTRIBUTED_CONVERSION (§3.8), CASHBACK_ACCRUAL (§3.4) each carry status; doc 06 §1 mandates "exactly one SoR per fact." Reversal-ordering CI gate target table is ambiguous. |
| H-10 | High (Sec) | Confirm-gate "independence" weaker than advertised | 2 of 3 corroboration legs (reporting-API pull, settlement file) are network-sourced; the only independent leg (panel) has the H-6 rotation gap. A complicit network can promote forged conversions to payable; detection is a delayed aggregate SLI, not a per-txn gate. |
| H-11 | High (Legal/Doc) | `disclosure` field absent from doc 07 API contract | 05/08/11 assert the API response MUST carry `disclosure` and the token-mint gate checks it; doc 07 contract examples contain 0 occurrences. FTC-disclosure enforcement degrades to convention. |
| H-12 | High (FinOps) | Sub-1M AI-cost floor not disclosed in primary docs; R-025 open | Sim 02 §5.4:179 discloses "at risk at sub-1M"; docs 05:626/09:432/ADR-0009 present ≤$0.01 as unconditional. R-025 (build-vs-buy burn) never closed by any ADR. Disclosure/business-risk, not a money-safety Critical. |
| H-13 | High (Maint/Doc) | Dangling anchors + ADR-0013 exactly-once mislabel | 10:859 dead anchor reintroduces retired "auto-buy"; `#7-cross-cutting-resilience-patterns` slug (used in 06/07/09/10) doesn't exist; ADR-0013:15 still says "exactly-once delivery semantics" vs corrected docs. |

---

## 6. Scores

- **Final Risk Score:** **34 / 100** (lower = better). The severe R4 fraud vector (C-1) is genuinely closed, dropping systemic risk sharply from prior rounds. Residual risk is moderate-low: one contained money-correctness schema Critical (C-B), one legal-vocab Critical (C-A), and three sophisticated-but-partial-mitigated security Highs (H-6/7/8). No catastrophic open vector.
- **Architecture Readiness (mean of 5 dimensions):** (90+84+92+90+87)/5 = **88.6 → 89**.
- **Production Readiness:** **80 / 100** — architecture is mature and most blockers are propagation/consistency fixes achievable in a short remediation pass, but 2 open Criticals and 5 failing gates mean the system is not launch-ready.

---

## 7. P0 Recommendation: **NO-GO**

GO requires **all** gates pass (Arch/Sec/Scale/Maint ≥95, Doc ≥98) **AND** zero open Criticals. Neither holds.

**Exactly what blocks GO:**
1. **Open Critical C-A** — doc 06:352 stale savings vocabulary (legal/FTC contradiction).
2. **Open Critical C-B** — doc 06 §3.7 `CONVERSION` composite-key idempotency violation (money correctness).
3. **Architecture 90 < 95** (C-B in the data model + H-9 SoR ambiguity).
4. **Security 84 < 95** (H-6/7/8 unpropagated; H-10 confirm-gate independence).
5. **Scalability 92 < 95** (designs unexecuted; H-12 cost-floor disclosure; R-025 open).
6. **Maintainability 90 < 95** (systemic ADR→doc propagation-QA gap).
7. **Documentation 87 < 98** (C-A + 13+ dangling anchors + missing doc-07 disclosure field).

**Path to GO (single focused remediation pass — no re-architecture needed):**
- Fix C-A (one string + CI lint) and C-B (`network` column + composite UK + SoR statement).
- Propagate H-6/7/8 language from ADR-0018/0022/0012 into docs 04/06/08 body **and** into the 04 §10 CI fitness functions.
- Add `disclosure` to doc 07 create/confirm response schemas (H-11).
- Repair the 13+ dangling anchors and the ADR-0013 exactly-once line (H-13).
- Add the sub-1M cost-floor caveat to docs 03/05/09 and close R-025 with a buy-first gate (H-12).
- Introduce a doc-consistency CI lint so the propagation-failure class cannot recur a third time.

Because the money-integrity spine (C-1) is now solid and every blocker above is a bounded propagation/consistency edit rather than a design flaw, a **Round-6 certification after this pass is expected to clear** — but it must be re-verified against source, not against the change log.

---

## 8. Note on Process Integrity

The recurrence of the **ADR-vs-doc propagation gap** on H-6/7/8 — in the same round that fixed exactly that failure for C-1 — is the single most important governance finding. The remediation is not trustworthy until a mechanical consistency gate (lint/CI) makes "ratified in ADR" and "present in the doc engineers build from" the same thing by construction. This report scores the **actual current doc state**, not the claimed state.
