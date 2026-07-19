# ADR-0012 — Postback integrity: provisional accrual, fingerprint dedup, forged-postback defense

**Status:** Accepted (remediation, Review R1) · **Date:** 2026-07-14 · **Deciders:** CTO, CFO, Security, Affiliate Commerce
**Closes:** R-002 (duplicate/failover double-attribution), R-003 (forged-postback drain), R-084 (archival vs return window), R-085 (out-of-order confirm/reverse).

## Context

Conversion postbacks are **async, network-controlled, reversible, out-of-order, duplicable, and often weakly authenticated** (many are plain GETs keyed on click/txn id, not an HMAC NEXUS can validate end-to-end). Three existential holes existed: (a) a forged postback accrues real payable liability; (b) multi-connector sourcing + failover ([ADR-0008](ADR-0008-affiliate-gateway.md)) can double-attribute one physical purchase with no global order key; (c) out-of-order confirm/reverse had no conflict rule.

## Decision

1. **Accrual is provisional by construction** (fixes R-003). A postback creates a **`pending`** accrual that is **non-payable** until *independently* corroborated (reconciliation pull per [ADR-0011](ADR-0011-attribution-reconciliation.md), and/or settlement-file match). The "signature-verified MUST" is replaced by a **per-connector auth table** (actual scheme/algorithm/rotation) in the [Affiliate Gateway](ADR-0008-affiliate-gateway.md); a postback whose scheme is weak is treated as an *unverified signal*, never as truth.
2. **Purchase-fingerprint dedup** (fixes R-002). At ingest, compute a probabilistic `purchase_fingerprint = hash(merchant, normalized_offer, user, amount_bucket, time_bucket)`. A fingerprint match within the longest cookie window routes to a **hold/adjudication queue**, not auto-credit. Buckets are **overlapping/jittered and cross-checked against per-user velocity + connector-pair collusion signals**, so a colluding connector pair cannot perturb one physical order across static bucket boundaries to double-claim (H-7). One **connector is pinned per (offer, session)** for the attribution window so mid-session failover cannot re-stamp. A `suspected_duplicate_rate` FinOps metric is exposed.
3. **Idempotent, order-independent postback state machine** (fixes R-085). `pending → confirmed → reversed` orders confirm/reverse by **NEXUS's own monotonic receipt sequence + a signed reconciliation decision — never the attacker-suppliable `network_event_at`** (amended by [ADR-0022](ADR-0022-round2-remediation.md) NC-3; a raw postback can never *un-reverse* a reversal); duplicate postbacks are idempotent on `(network, txn_id)`. Reversals post compensating ledger entries.
4. **Archival respects reversal windows** (fixes R-084): referral/attribution partitions are retained **at least the longest network return/reversal window** before archival, so a late reversal always finds its accrual.

## Options considered
| Option | Verdict |
|--------|---------|
| Auto-credit on postback + post-hoc clawback | ❌ pays fraud before detection; clawback races money out (see [ADR-0014](ADR-0014-wallet-hold-gate.md)) |
| **Provisional accrual + fingerprint + reconciliation gate** | ✅ chosen |
| Require order-hash from all networks | ❌ not all expose it; use as trust-weight where available |

## Consequences
- **+** Forged/duplicate postbacks cannot become payable liabilities; closes the existential fraud vectors.
- **−** Cashback becomes visible later (worse UX) → mitigated by clear pending/confirmed states ([ADR-0014](ADR-0014-wallet-hold-gate.md), fixes R-022); dedup adds false-positive holds → sized as a fraud-loss budget.
- **−** Fingerprinting is probabilistic; documented as such with an explicit false-positive/negative budget.

## Rollback
The state machine is versioned; the fingerprint threshold and hold-queue are config-flagged. Disabling reverts to provisional-only accrual (still safe — never auto-pays).

## Affected docs
[04 §5.4](../04-system-architecture.md), [06 §3.7/§3.8](../06-database-architecture.md), [07](../07-api-architecture.md) (postback ingest), [08 §5.6/§7](../08-security-architecture.md), [ADR-0008](ADR-0008-affiliate-gateway.md), [ADR-0011](ADR-0011-attribution-reconciliation.md).
