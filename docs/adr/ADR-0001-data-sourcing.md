# ADR-0001 — Data sourcing via authorized channels only

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** CEO, CTO, COO, Security/Legal

## Context

NEXUS aggregates product, offer, price, coupon, review, and travel data across many merchants. The obvious "fast" path — web scraping — is illegal or TOS-violating in most jurisdictions/sites, creates existential legal risk, produces brittle pipelines, and poisons trust. Our Prime Directive forbids it.

## Decision

All external data enters NEXUS **exclusively** through authorized channels:
- Official merchant/marketplace **APIs** (e.g., Amazon PA-API).
- **Licensed merchant feeds** (contracted product/offer feeds).
- **Affiliate networks** (CJ, Impact, Rakuten, etc.) providing sanctioned catalogs + attribution.
- **Authorized travel APIs** (Duffel/Amadeus, Booking affiliate).

Each source is integrated behind a dedicated **Source Adapter** that **license-tags** every record with its provenance and permitted uses (cache? display text? redistribute image? price freshness rules?). Downstream services MUST enforce those tags. **No adapter may exist for a non-authorized source** — legitimacy is structural.

## Options considered

| Option | Verdict |
|--------|---------|
| Web scraping / arbitrage | ❌ Illegal/TOS-violating, existential risk, brittle |
| Gray-market data brokers | ❌ Provenance/licensing unclear; compliance risk |
| **Authorized APIs + licensed feeds + affiliate networks** | ✅ Chosen — legal, durable, attribution-native |

## Consequences

- **+** Legally durable; partner-friendly; attribution built-in; trust preserved.
- **+** Compliance-by-design; enables the neutrality + savings-share business model.
- **−** Catalog breadth gated by partnerships (mitigate: multi-network + direct deals; concierge merchant onboarding).
- **−** Per-source license enforcement adds engineering overhead (mitigate: adapter + license-tag framework).

## Related
[System Architecture §5.2](../04-system-architecture.md), [Business Model](../03-business-model.md), [Security Architecture](../08-security-architecture.md).
