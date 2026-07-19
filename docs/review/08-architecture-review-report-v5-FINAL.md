# Architecture Review Report v5 — FINAL (Round 6 Certification)

**Project:** NEXUS Commerce OS · **Phase:** 0 (Documentation & Architecture) · **Date:** 2026-07-14
**Review type:** Final certifying review (R6-review) · **Board:** 13 reviewers + Chair
**Verification basis:** current source text of `docs/**` and `docs/adr/**` — NOT the change log. `docs/review/*` treated as dated historical artifacts.

---

## 1. Executive Summary

Round-6 remediation is **substantially real and source-verified**. Both Round-5 blocking Criticals are genuinely fixed at source: **C-A** (doc06 stale savings vocabulary) now uses the ratified four-state model *Estimated → Pending → Confirmed → Reversed* with VMS counted from Confirmed only (doc06:352, cites ADR-0021 D4); **C-B** (single-column idempotency key) now carries the mandated composite `UK(network, network_txn_id)` on **both** CONVERSION (§3.7, doc06:477) and ATTRIBUTED_CONVERSION (§3.8, doc06:518). The reversal-ordering fix (NEXUS monotonic receipt-sequence + signed reconciliation decision, **never** `network_event_at`) is now byte-consistent across 04 §5.4 / 06 §3.8 / 07 §9 / ADR-0012 — the R3/R4 propagation defect does not recur here. The **design itself remains unanimously affirmed sound**: no fund-loss-capable exploit was found by any reviewer in the composite-key idempotency, event-driven accrual fan-out, panel-blinding, or hardened-runtime designs.

**However, this review is NOT a clean GO.** Two genuine, source-verified open Criticals remain, and neither is a design defect — both are **doc-fidelity / traceability failures of the exact class this entire review cycle exists to eliminate**, and both contradict validation claims made in `PROJECT_MEMORY.md`'s Round-6 entry:

1. **Unqualified `exactly-once` survives in the flagship database doc** (doc06:402 and doc06:893) — a term the round's own new doc-consistency lint (04 §10) explicitly names as banned. PROJECT_MEMORY:149 scopes the exactly-once→effectively-once fix only to "(07/ADR-0013)" — doc06 was never touched — while the same entry asserts "**banned-terms PASS**." That validation claim is false against current source.
2. **`ADR-INDEX-lineage.md` is stale by a full round** — its Review-lineage table (line 76) ends at "R5 | pending Round-5 certification," with no entry for R5's actual NO-GO (2 new Criticals) and nothing for R6. The one artifact whose stated purpose is "single-glance traceability" reproduces the tracking-doc-not-updated failure inside itself.

Both are **mechanically cheap to close** (edit two lines in doc06; add two rows to one table) with **zero design change**. Verdict: **CONDITIONAL-GO** — P0 is authorized to kick off the instant these two named doc-fidelity Criticals are closed and the doc-consistency lint is re-run clean over the full `docs/` tree.

---

## 2. Score Delta: Round 1 → Round 6

| Dimension | R1 | R2 | R3* | R4 | R5 | **R6** | Gate | Pass? |
|-----------|----|----|-----|----|----|--------|------|-------|
| Architecture | 62 | 73 | — | 88 | 90 | **96** | ≥95 | ✅ |
| Security | 60 | 74 | — | 88 | 84 | **95** | ≥95 | ✅ (boundary) |
| Scalability | 63 | 78 | — | 91 | 92 | **96** | ≥95 | ✅ |
| Maintainability | 68 | 66 | — | 92 | 90 | **89** | ≥95 | ❌ |
| Documentation | 85 | 80 | — | 89 | 87 | **91** | ≥98 | ❌ |
| **Open Criticals** | 20 | 9 new | — | 1 | 2 | **2** | 0 | ❌ |

\* R3 was a remediation pass, not a scored certification round (its "validated" claim was later retracted in R4).

Trajectory is strongly positive on design substance; the two remaining failures are documentation/traceability, not architecture.

---

## 3. Gate Table — Per-Dimension Verdict with Source Evidence

| Dimension | Score | Gate | Verdict | Source-verified basis |
|-----------|-------|------|---------|-----------------------|
| **Architecture** | 96 | ≥95 | ✅ PASS | Composite key fixed & consistent (06:477/518); event-driven accrual (04:233, ADR-0022 NC-2) uniform; reversal ordering byte-consistent (04 §5.4 / 06 §3.8 / 07 §9 / ADR-0012), zero residual `network_event_at`-as-arbiter language. Zero architecture-dimension open Criticals. Residual Highs: lint/reversal fitness functions are prose specs (no code yet — appropriate for Phase 0); `txn_id` vs `network_txn_id` prose naming nit. |
| **Security** | 95 | ≥95 | ✅ PASS (boundary) | Both R5 Criticals fixed at source; H-8 hardened runtime (gVisor/Kata/microVM) verbatim in 04:196 & 08:374; postback integrity coherent across schema/ADR-0011/0012/0022; legal Criticals R-023/R-024 controlled via ADR-0021. **No fund-loss exploit found by any reviewer.** Held at gate boundary (not higher) for the confirmed H-6/H-7 propagation gap (below) and the banned-term contradiction sitting adjacent to the idempotency machinery — both doc-fidelity, not exploit-surface. |
| **Scalability** | 96 | ≥95 | ✅ PASS | Surge admission-control (09 §7.1) & OpenSearch cellularization (06 §6.1) fully worked; 5,000-QPS as hard EXECUTED P1 gate & ×10-15 surge as P2 gate, figures identical across 09/10/sim; sub-1M cost floor disclosed with matching R-025 figures in 03/05/09; grounding/price-verify budget protected & not rollback-eligible (ADR-0015). Unexecuted tests honestly labeled (Phase-0), not concealed. |
| **Maintainability** | 89 | ≥95 | ❌ FAIL | **Open Critical:** `ADR-INDEX-lineage.md:76` stale by a full round (no R5 NO-GO, no R6). Also: lint banned-terms rule under-specified (would false-positive on legitimate `clawed-back`/`promised` prose in doc08:139, doc12:7); lint wired into 10 §2 only as narrative, no Stage-detail row/flowchart node unlike peer fitness functions. Bulk of remediation is real & durable; one open Critical caps below gate. |
| **Documentation** | 91 | ≥98 | ❌ FAIL | **Open Critical:** unqualified `exactly-once` at doc06:402 (§3.6 pt.4) and doc06:893 (§8) — the exact banned term (04 §10) in the most-scrutinized doc, while every peer (04:133/233, 07:488, 08:477, ADR-0013:15) correctly says `effectively-once`. Contradicts PROJECT_MEMORY:149 "banned-terms PASS." Positives verified: four-state vocab consistent everywhere; composite UK in both ER diagrams; disclosure field present (doc07); zero dangling anchors in current-state docs. |

**gatesPass = FALSE** — Documentation (91 < 98) and Maintainability (89 < 95) below gate; openCriticalsCount = 2 ≠ 0.

---

## 4. Open Criticals (2, deduped)

### C-R6-1 — Unqualified `exactly-once` in flagship DB doc (Documentation)
- **Evidence:** `docs/06-database-architecture.md:402` — "`idempotency_key` … makes posting **exactly-once** under redelivery"; and `:893` — "**Exactly-once posting** to the ledger = at-least-once delivery + unique `idempotency_key` constraint…". The lint spec at `docs/04-system-architecture.md:314` names "unqualified `exactly-once`" as a banned term the CI gate must fail on. Every other canonical location correctly uses `effectively-once` (04:133, 04:233, 07:488, 08:477, ADR-0013:15).
- **Why Critical:** This is the precise defect class (H-4/H-13, exactly-once mislabel on a money-critical mechanism) that produced NO-GO in prior rounds, recurring in the one doc under most scrutiny. PROJECT_MEMORY:149 scopes the fix to "(07/ADR-0013)" only yet claims "banned-terms PASS" — a **false validation claim**. Either the flagship lint cannot ship green on the current doc set, or the PASS claim is untrue; both block the doc ≥98 gate. Flagged independently by Documentation Certifier (91) and Fresh Red Team (83); Honesty Auditor & Fresh Distributed-Systems note it as a scoping/precision defect.
- **Fix (mechanical, no design change):** Qualify both lines — e.g. "posting is **idempotent (effectively-once)** under redelivery via the unique `idempotency_key` constraint" — OR add an explicit, documented lint scoping rule distinguishing ledger-posting idempotency from relay delivery semantics. Then re-run the lint and correct the PROJECT_MEMORY claim.

### C-R6-2 — `ADR-INDEX-lineage.md` stale by a full round (Maintainability)
- **Evidence:** `docs/adr/ADR-INDEX-lineage.md:76` — Review-lineage table's last row is "R5 | this remediation (C-1 + H-1…H-15 fixes) | **pending Round-5 certification**"; §3 line 67 frames Round 5 as a completed propagation event. Current truth (PROJECT_MEMORY:147) is that R5 **ran and returned NO-GO** with 2 new Criticals (C-A/C-B) + the recurring propagation failure, and R6 has since remediated them and added the lint — none of which appears in the index.
- **Why Critical:** This is the designated "single-glance traceability / Living index" artifact (its own §1 header) and the flagship maintainability deliverable. An engineer or auditor trusting it would believe R5 certification is still pending and be unaware of C-A/C-B, the H-6/7/8 work, or the new lint — the exact "decision updated but tracking doc not updated" failure this cycle was built to catch, reproduced inside the lineage map itself. Rated open Critical by the Maintainability Certifier (89).
- **Fix (mechanical):** Add an R5 row ("2 new Criticals C-A/C-B + recurring propagation failure · NO-GO") and an R6 row (remediation + doc-consistency lint), and update §3 note 67 to reflect R5's actual outcome.

---

## 5. Residual Highs to Track into P0 (non-blocking)

1. **H-6/H-7 propagation incomplete (verified).** Panel rotation/population-diversification (H-6) and fingerprint jitter/collusion cross-check (H-7) are present in doc06:483/549 and ADR-0012, but **absent from doc04 §5.4, doc07, and doc08** (only H-8 truly propagated to 04/08). PROJECT_MEMORY:149's "H-6/7/8 propagated into canonical docs 04/06/07/08" is inaccurate for H-6/H-7. An implementer building postback-dedup off doc04 alone could ship a non-jittered, non-collusion-aware fingerprint, reopening the R-002/H-7 fraud vector. *High, not Critical* — the authoritative schema doc (06) and ADRs are correct. (AI-Safety Certifier, FinOps corroborate.)
2. **Doc-consistency lint is a prose spec, not executable code.** No lint script/config exists in-repo; "RUN / PASS" in the change log overstates a manual grep-audit as a mechanical CI gate. Acceptable for Phase 0 (docs-before-code), but must become a checked-in, executable P0-kickoff deliverable. (Architecture, Security, Honesty Auditor.)
3. **Lint banned-terms rule needs scoping before it can be merge-blocking.** As literally described it would false-positive on legitimate current prose: `clawed-back` (doc06, doc08 mechanism vocabulary) and `promised` (doc08:483/665 historical R-022 lineage note), and unqualified `exactly-once` ledger-posting usage. Needs an explicit allowlist/word-boundary/section-scope rule. (Maintainability, Fresh Red Team, Fresh Distributed-Systems, Documentation.)
4. **Lint wiring asymmetry.** In 10 §2 the lint appears only as narrative prose, with no Stage-detail table row or CI-flowchart node, unlike every peer fitness function. (Maintainability.)
5. **Cosmetic key-name drift.** Prose in 04 §5.4/§7, 07 §9, ADR-0012 says `(network, txn_id)`; schema column is `network_txn_id`. One-line terminology fix. (Fresh Distributed-Systems.)
6. **Falsifiability of H-6/H-7 controls.** Panel rotation cadence and fingerprint collision-resistance are stated qualitatively with no measurable acceptance criteria (unlike VMS's R-021 confidence bounds). (Fresh Red Team.)
7. **Fingerprint hold-queue griefing vector.** A rate-limit-compliant malicious connector can park a target population's accruals in `pending/hold` indefinitely; no capacity/backpressure/SLA bound documented. Money invariants intact; availability/timeliness vector unaddressed. (Fresh Red Team.)
8. **Sub-1M cost discipline is un-gated.** Disclosed honestly in prose (03/05/09) but no automated NFR/dashboard threshold enforces the "hosted-heavy pre-PMF" choice. (FinOps.)
9. **Bug-bounty is SHOULD-by-H1/MUST-by-H2**, a pre-launch gap if P1 GA lands first. (Security.)
10. **Cosmetic:** ADR-0021 D5 cites "ADR-0020 §9" which has no numbered sections (enforcement actually in doc04 §5.3/§10). No broken anchor. (Legal/Compliance.)

---

## 6. Scores

- **Final Risk Score:** **22 / 100** (lower = better). Two open Criticals, but both are doc-fidelity/traceability with **no fund-loss or exploit surface**; design unanimously affirmed sound. Moderate-low residual risk dominated by process/consistency, not architecture.
- **Architecture Readiness Score (mean of dimensions):** **93 / 100** — (96+95+96+89+91)/5.
- **Production Readiness Score:** **88 / 100** — production-grade design blocked only by two mechanical documentation fixes and the not-yet-coded lint gate.

---

## 7. P0 Decision: CONDITIONAL-GO

**P0 is NOT unconditionally authorized** — gatesPass = FALSE (Documentation 91 < 98, Maintainability 89 < 95, 2 open Criticals). A clean GO here would be a governance violation.

**But this is not a NO-GO on substance.** The architecture is certified sound by every reviewer; no design defect and no fund-loss exploit remain. Both blockers are mechanical documentation edits with zero design impact.

**CONDITIONAL-GO — P0 kicks off the instant ALL of the following close:**

1. **[C-R6-1]** Qualify `exactly-once` at doc06:402 and doc06:893 to `effectively-once`/idempotent framing (or add & document an explicit lint scoping rule for ledger-posting idempotency), and correct the "banned-terms PASS" claim in PROJECT_MEMORY.
2. **[C-R6-2]** Update `ADR-INDEX-lineage.md` §4 table (add R5 NO-GO row + R6 remediation row) and §3 note 67 to reflect R5's actual outcome.
3. **Re-run the doc-consistency lint over the full `docs/` tree** (including `docs/review/`) after scoping its banned-terms rule (Residual High #3) so it passes green without false positives — this converts the two Criticals from "manually asserted closed" to "mechanically verified closed."

**Track into P0 as first-sprint hardening:** Highs #1 (complete H-6/H-7 propagation to 04/07/08 — this is a real fraud-control gap, prioritize), #2 (make the lint executable and CI-wired), and #4 (lint wiring symmetry).

Once items 1–3 are verified, gatesPass flips true and P0 is a clean GO.

---

*Chair certification: verified against current source text, not the change log. A GO not earned and a NO-GO on vibes are both governance violations; this verdict is CONDITIONAL-GO because the design is certified sound while two source-confirmed doc-fidelity Criticals remain open and cheaply closable.*
