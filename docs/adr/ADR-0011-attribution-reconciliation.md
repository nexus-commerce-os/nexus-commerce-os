# ADR-0011 — Attribution reconciliation & revenue-integrity subsystem

**Status:** Accepted (remediation, Review R1) · **Date:** 2026-07-14 · **Deciders:** CTO, CFO, Affiliate Commerce, Security
**Closes:** R-001 (undetectable attribution under-reporting), R-021 (VMS unfalsifiable), R-033 (non-deterministic postback), partial R-046.

## Context

Under [ADR-0006](ADR-0006-referral-only-model.md) (pure referral), **100% of primary revenue and the VMS north-star depend on asynchronous, network-controlled, reversible postbacks that NEXUS never independently observes**. The original design "reconciled" postbacks only against the *same network's* settlement reports — i.e., it trusted the counterparty to grade its own homework. Under-reporting (accidental or adversarial) is therefore **invisible**: the revenue numerator and the CFO's >80% margin guardrail are computed on a systematically understated figure with no alarm.

## Decision

Build a first-class **Attribution Reconciliation subsystem** that gives NEXUS an *independent* view of expected vs. reported conversions.

1. **Own the click-out ledger.** Every `handoff.redirected` is logged by NEXUS with a NEXUS-minted `click_id` (source of truth we control), independent of any network.
2. **Three-way reconciliation.** Per network/region/period, compare: (a) NEXUS click-out volume × modeled conversion rate, (b) the network's **reporting API** pull, and (c) a **sampled real-purchase panel** (opt-in users / seeded test purchases). Compute an `attribution_gap_rate` per network/region.
3. **Baselines + anomaly alerts.** Expected conversion rates are baselined; a statistically significant drop-off in reported-vs-expected raises a **revenue-integrity SLI** into the FinOps/anomaly infra ([ADR-0009](ADR-0009-ai-cost-strategy.md) infra reused).
4. **VMS made falsifiable** ([fixes R-021](../review/01-master-risk-register.md)): VMS is reported with **confidence bounds** and is **audited** against the sampled panel; the metric definition names what would *disprove* a savings claim.
5. **Per-connector postback mechanism is modeled explicitly** (fixes R-033): the [Affiliate Gateway](ADR-0008-affiliate-gateway.md) connector interface declares each network's real attribution mechanism (real-time pixel vs. batch file vs. API pull — e.g., Amazon is batch), and reconciliation cadence adapts per connector.

## Options considered
| Option | Verdict |
|--------|---------|
| Trust network settlement reports (original) | ❌ counterparty grades own homework; leak invisible |
| **Independent 3-way reconciliation + panel** | ✅ chosen — detectable, quantified gap |
| Direct merchant S2S webhooks for top merchants | ✅ adopt *additionally* for top merchants (higher certainty) |

## Consequences
- **+** Revenue leak becomes measurable and alertable; VMS defensible.
- **−** Depends on networks exposing reporting APIs (not guaranteed for all 4) → where absent, lean on panel + merchant-direct; document residual gap as a **modeled fraud/margin budget**.
- **−** New ops surface (reconciliation jobs, panel management).

## Rollback
Reconciliation is additive/observational — disabling it reverts to raw postback accrual (the pre-ADR state) with a logged loss of the integrity SLI. No data migration.

## Affected docs
[03 Business Model](../03-business-model.md) (VMS + margin), [04 §5.4](../04-system-architecture.md), [06](../06-database-architecture.md) (click-out ledger, reconciliation store), [08 §7](../08-security-architecture.md), [ADR-0008](ADR-0008-affiliate-gateway.md).
