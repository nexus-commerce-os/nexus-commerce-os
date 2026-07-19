# ADR-0022 — Round-2 remediation (amends 0011–0019; closes NC-1…NC-9 + partials)

**Status:** Accepted (remediation, Review R2) · **Date:** 2026-07-14 · **Deciders:** CTO + Review Board Chair
**Closes (technical):** NC-1…NC-9 and partials R-009, R-012, R-014, R-019, R-020.
**Deferred at R2 to approval (R-021, R-022 presentation, R-023, R-024):** these were approval-gated at Round 2 and have since been **closed by [ADR-0021](ADR-0021-legal-product-truth.md), ratified 2026-07-14** (D1–D5). *(This ADR was authored while ADR-0021 was still Proposed.)*

## Context
Round-2 verified 15/24 R1 Criticals closed but found the remediation itself introduced 9 new Criticals and 5 partials. This ADR fixes them and, per the "avoid unnecessary complexity" governance rule, *simplifies* the ledger fan-out rather than adding coordination machinery.

## Decisions

### Money-integrity corrections
- **NC-2 — no cross-ledger atomic fan-out (simplify).** A conversion does **not** synchronously write three sub-ledgers. It emits **one `conversion.confirmed` event**; each domain sub-ledger (affiliate, cashback, rewards) **idempotently consumes it independently** (at-least-once + dedup on event id). There is no distributed write to compensate — per-domain accrual is eventually consistent by construction, and the GL reconciles. *This removes complexity, not adds it.* (Amends [ADR-0013](ADR-0013-ledger-per-context.md).)
- **NC-3 — reversal ordering uses NEXUS-authoritative sequence.** Confirm/reverse ordering keys on **NEXUS's own monotonic receipt sequence + a signed reconciliation decision**, never on the attacker-suppliable `network_event_at`. A reversal is authoritative only when corroborated by reconciliation ([ADR-0011](ADR-0011-attribution-reconciliation.md)); a raw postback cannot "un-reverse" a reversal. (Amends [ADR-0012](ADR-0012-postback-integrity.md).)
- **NC-1 — blinded reconciliation panel.** The real-purchase panel is **blinded from the audited networks** (panel identities/purchases are not distinguishable to a network), so a network cannot selectively report panel traffic correctly while under-reporting the rest (defeat-device). The panel is **rotated and population-diversified on a schedule** so a resourced counterparty cannot behaviorally fingerprint members and selectively fully-report their traffic (H-6). (Amends [ADR-0011](ADR-0011-attribution-reconciliation.md).)

### Portability / ops corrections
- **NC-9 / R-012 — control-plane lock-in is in scope.** The portability gate + exit runbook explicitly cover the **AWS control-plane** dependencies (IRSA, Global Accelerator, Route 53, Shield, Control Tower, Config/SCP): each is behind an abstraction or has a documented per-cloud equivalent in the exit runbook; the CI check flags un-abstracted control-plane use, not only data-plane SDKs. (Amends [ADR-0019](ADR-0019-portability-ops-maturity.md).)
- **R-019 — CRD/API-deprecation scanner.** CI scans manifests against the target Kubernetes + Istio/Argo/Kyverno **API-deprecation schedules**; a removed/deprecated API fails the upgrade gate.
- **R-009 — canary is per-capability, not only per-region.** AI routing-policy canaries roll out **per capability class** (search-rank, agent-reason, claim-verify) as well as per region, so a bad policy for one capability can't reach all capabilities at once. (Amends [ADR-0017](ADR-0017-blast-radius-isolation.md).)
- **R-020 — egress config is canaried.** The egress allowlist is **versioned + canaried per cell** (not one shared config flipped globally); a bad allowlist change hits one cell. (Amends [ADR-0017](ADR-0017-blast-radius-isolation.md).)

### Consistency / honesty corrections
- **NC-4 — money-integrity is an execution-plan exit gate.** Doc 10 §12: **P1** exit gate requires the provisional-accrual + reconciliation path live (ADR-0011/0012); **P2** requires ledger-per-context + wallet hold-gate + blast-radius isolation live (ADR-0013/0014/0017). No money feature ships without them.
- **NC-5 — R-081 honestly addressed.** The 4-tier cache does **not** assume a long-tail hit-rate: personalized/long-tail queries are modeled with a **low hit-rate + cheap-tier cascade fallback**; the FinOps dashboard tracks hit-rate by query class and the $0.01 blended target is validated against the *actual* long-tail mix (no assumed hit-rate). (Amends [ADR-0015](ADR-0015-ai-trust-cost-integrity.md).) *(If content still absent after doc patch, R-081 stays open — not phantom-closed.)*
- **NC-6 — R-022 wording reconciled.** [ADR-0014](ADR-0014-wallet-hold-gate.md) closes the **backend** money-state (available/held); the **customer-facing presentation** (four-state Estimated→Pending→Confirmed→Reversed) was subsequently **ratified in [ADR-0021](ADR-0021-legal-product-truth.md) D4 (2026-07-14)** — so R-022 is now fully closed across backend + presentation. *(At R2 the presentation half was still open; this note is retained for lineage.)*
- **NC-8 — R-024 restored to bookkeeping.** Doc 08's OPEN-Criticals list + compliance matrix explicitly carry **R-024** (travel/ATOL) alongside R-023.
- **NC-7 — simulation re-run.** The scalability simulation is re-run/annotated against the remediation (egress cells, discovery/money split, ledger-per-context, reconciliation load, warm-GPU floor) so the scale gate is certifiable from evidence.
- **R-014 — staging topology reconciled.** Docs 09 and 10 agree: staging includes an **ap-south-1 tier** so residency/DR is tested before the P4 South-Asia market; the 09-vs-10 staging contradiction is removed.

## Backward compatibility / Migration / Rollback
- **Compat:** all changes are internal (event-driven accrual, ordering source, CI scope, doc gates); no external contract change.
- **Migration:** switch conversion accrual to event-driven consumers; add control-plane abstractions/exit-runbook entries; wire the new CI scanners + execution-plan gates.
- **Rollback:** each is flag/config reversible except the reversal-ordering source and blinded panel (**safety-critical, not rollback-eligible**).

## Related
[ADR-0011](ADR-0011-attribution-reconciliation.md), [ADR-0012](ADR-0012-postback-integrity.md), [ADR-0013](ADR-0013-ledger-per-context.md), [ADR-0014](ADR-0014-wallet-hold-gate.md), [ADR-0015](ADR-0015-ai-trust-cost-integrity.md), [ADR-0017](ADR-0017-blast-radius-isolation.md), [ADR-0019](ADR-0019-portability-ops-maturity.md), [ADR-0021](ADR-0021-legal-product-truth.md).
