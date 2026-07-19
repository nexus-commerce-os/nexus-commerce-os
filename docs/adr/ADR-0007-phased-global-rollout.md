# ADR-0007 — Phased global rollout & internationalization-by-design

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** Founder/CEO (ratified), CTO, COO, Security/Legal

## Context

NEXUS targets global scale but cannot absorb every jurisdiction's regulatory, tax, currency, and language surface at once. OQ#2 ratifies a **phased geographic rollout** that prioritizes product-market fit before regulatory breadth — while requiring the *architecture* to be international from day one so each new region is a configuration/enablement step, not a re-architecture.

## Decision

**Phased market rollout** (feature-flagged per country):

| Phase | Markets |
|-------|---------|
| 1 | United States |
| 2 | Canada, United Kingdom, Australia |
| 3 | European Union |
| 4 | Bangladesh, India, Pakistan, Middle East |
| 5 | Global expansion |

**Internationalization-by-design (MUST, from day 1 — even while only the US is live):**
- **Multi-currency** — all monetary values carry an explicit currency; no implicit USD; FX handled centrally.
- **Multi-language (i18n)** — no hard-coded user-facing strings; locale + RTL support in the platform even before non-English markets launch.
- **Country feature flags** — every market gated by a flag; enabling a country is a controlled rollout, not a deploy.
- **Regional compliance modules** — pluggable per-jurisdiction policy packs (GDPR, CCPA/CPRA, UK-GDPR/DPA, Australian Privacy Act, PIPEDA, BD-DPA, etc.) selected by user region.
- **Tax abstraction layer** — a provider-agnostic interface for tax display/calculation rules per region (VAT/GST/sales-tax display), so tax logic is never hard-wired. *(Note: as a pure referral platform per [ADR-0006](ADR-0006-referral-only-model.md), NEXUS does not collect tax — this layer governs correct **all-in landed-cost display**, and future-proofs P7 custody.)*
- **Region-specific affiliate routing** — the [Affiliate Gateway](ADR-0008-affiliate-gateway.md) routes to the right network/merchant program for the user's region.

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Big-bang multi-region launch | Global from day 1 | Triples compliance/tax/i18n work pre-PMF; huge risk | ❌ |
| US-only, i18n retrofitted later | Fastest first ship | i18n/currency retrofits are notoriously expensive & bug-prone | ❌ |
| **Phased markets + i18n-by-design from day 1** | PMF focus **and** cheap regional expansion | Upfront i18n/multi-currency discipline | ✅ **chosen** |

## Consequences
- **+** Compliance surface grows one controlled step at a time; expansion is config, not rewrite.
- **+** No painful i18n/currency retrofit.
- **−** Day-1 discipline cost (currency/locale plumbing before it's "needed") — accepted as cheap insurance.
- **−** Regional compliance modules must be built as the rollout reaches each phase; gate each market behind a legal sign-off.

## Rollback
Country feature flags make market rollout **instantly reversible** — disabling a country flag removes it from routing without a deploy. Compliance-module or tax-provider swaps are adapter changes (per [ADR-0010](ADR-0010-platform-principles.md)).

## Related
[Vision](../01-vision.md), [Cloud](../09-cloud-architecture.md), [Security](../08-security-architecture.md), [ADR-0008](ADR-0008-affiliate-gateway.md).
