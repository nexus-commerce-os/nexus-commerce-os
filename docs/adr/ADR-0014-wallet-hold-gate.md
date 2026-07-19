# ADR-0014 — Wallet available/held split, payout hold-gate & clawback safety

**Status:** Accepted (remediation, Review R1) · **Date:** 2026-07-14 · **Deciders:** CTO, CFO, Security, Legal
**Closes:** R-005 (payout races clawback → unrecoverable leak), R-022 backend (no available/held wallet split for savings UX), R-037 (stored-value money-transmitter exposure).

## Context

Cashback has a hold/clawback window ([ADR-0009 §9](ADR-0009-ai-cost-strategy.md) / [09 §9](../09-cloud-architecture.md)), but the wallet exposed a **single `balance_cash`** with no available/held split and **no rule blocking payout until the accrual is confirmed**. A user could request payout during the hold window; real money leaves via the payout partner; a later reversal posts a reversing entry but **the cash is gone and NEXUS has no custody to claw back** — an unrecoverable leak *and* a fraud recipe (accrue → pay out → return the goods).

## Decision

1. **Two-balance wallet model.** The wallet exposes **`available`** and **`held`** (pending) balances. Postback-driven accrual lands in **`held`** ([ADR-0012](ADR-0012-postback-integrity.md) provisional state) and moves to **`available`** **only** when the accrual reaches `confirmed` after the hold/clawback window.
2. **Payout hold-gate (MUST).** A payout can draw **only** from `available`. A `pending`/`held` amount is **never payable**. This is enforced server-side in the wallet domain sub-ledger ([ADR-0013](ADR-0013-ledger-per-context.md)), not in UI.
3. **Clawback cannot race money out** (fixes R-005): because reversals during the window hit `held` (not-yet-paid), the reversing entry always has funds to reverse. Confirmed→reversed after payout is a rare tail handled by negative-balance recovery + collusion detection, not the default path.
4. **Savings-state UX** (fixes R-022): the wallet's available/held split backs the ratified four-state savings model **Estimated → Pending → Confirmed → Reversed** ([ADR-0021](ADR-0021-legal-product-truth.md) D4); VMS counts **Confirmed** only, so users are never shown money they might not keep. *(This ADR covers the backend state; the customer-facing presentation is ratified in ADR-0021 D4.)*
5. **Money-transmitter / e-money exposure addressed** (fixes R-037): because NEXUS holds no user funds (referral model) and cashback is a **merchant-funded rebate paid out via a licensed partner** — not stored value the user can transfer — we structure it to stay **outside money-transmitter/e-money licensing** where possible; Legal reviews per jurisdiction ([ADR-0007](ADR-0007-phased-global-rollout.md) phase gates). If a jurisdiction deems held rebate = stored value, that market's flag stays off until licensed.

## Options considered
| Option | Verdict |
|--------|---------|
| Single balance + post-hoc clawback (original) | ❌ pays before confirm; unrecoverable leak |
| **Available/held split + payout hold-gate** | ✅ chosen |
| Instant payout + fraud insurance | ❌ premium cost + still leaks on systematic abuse |

## Consequences
- **+** Money cannot leave before it is confirmed; the accrue→payout→return fraud is closed by construction.
- **+** Honest savings UX builds trust (ties to VMS integrity, [ADR-0011](ADR-0011-attribution-reconciliation.md)).
- **−** Cashback is spendable/withdrawable later than users might want → mitigated by clear state UX and showing the confirm date.
- **−** Per-jurisdiction licensing review may delay a market (acceptable; gated by ADR-0007).

## Rollback
The available/held split is the durable model; the hold-window length is config. Reverting to single-balance is explicitly forbidden (it reintroduces R-005) — any exception requires a superseding ADR.

## Affected docs
[03 §4](../03-business-model.md), [06 §3.5](../06-database-architecture.md) (wallet), [08 §8.3](../08-security-architecture.md) (payout controls), [01 §UX](../01-vision.md), [ADR-0012](ADR-0012-postback-integrity.md), [ADR-0013](ADR-0013-ledger-per-context.md).
