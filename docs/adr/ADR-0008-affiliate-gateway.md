# ADR-0008 — Affiliate Gateway: plugin architecture with automatic failover

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** Founder/CEO (ratified), CTO, Affiliate Commerce Expert, Principal Backend Engineer

## Context

NEXUS's revenue and catalog depend entirely on affiliate networks and licensed feeds ([ADR-0001](ADR-0001-data-sourcing.md), [ADR-0006](ADR-0006-referral-only-model.md)). OQ#3 ratifies the launch partner set and a hard design rule: **no provider may be a single point of failure**, and adding/replacing a provider must not require touching core code.

## Decision

Introduce an **Affiliate Gateway** — a dedicated abstraction in front of all affiliate/feed providers, built as a **plugin architecture**:

- **Common connector interface (MUST).** Every provider is a **connector** implementing one interface: `catalog/feed sync`, `offer/price lookup`, `deep-link/affiliate-link build`, `attribution stamp`, `conversion postback ingest`, `health check`, `capabilities` (regions, categories, rate limits, TOS flags). Core code depends only on the interface, never a specific provider.
- **License/region metadata per connector.** Each connector declares permitted uses (license-tag, [04 §5.2](../04-system-architecture.md)) and the regions it serves (feeds [ADR-0007](ADR-0007-phased-global-rollout.md) region routing).
- **No SPOF / automatic failover (MUST).** For any given offer/merchant, the Gateway can source via **multiple** connectors; a provider outage or rate-limit **fails over automatically** (circuit breaker + health-based routing) to an alternate connector or cached data **without user-visible failure** — degrade to cached price with a staleness badge if all fail (SDD §9).
- **Deterministic attribution across providers.** Click-id/attribution is normalized so failover never loses or double-counts attribution.

**Launch partner set (production requirement before P1):** Amazon PA-API · CJ Affiliate · Impact · Rakuten Advertising.
**Optional pre-launch if available:** eBay Partner Network · Walmart Affiliate · AliExpress Portals.

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Direct per-provider integration in core | Simple at first | Every provider is a SPOF; core churns per provider; no failover | ❌ |
| Single "best" network only | Least code | Existential dependency; de-listing = outage; violates OQ#3 | ❌ |
| **Gateway + plugin connectors + failover** | No SPOF; providers hot-swappable; regional routing | Gateway is itself critical (must be hardened/HA) | ✅ **chosen** |

## Consequences
- **+** Any single network can fail or de-list us without downing the platform.
- **+** New providers ship as connectors (no core change); satisfies [ADR-0010](ADR-0010-platform-principles.md) replaceability.
- **−** The Gateway becomes a critical component → runs HA/multi-AZ, health-checked, with its own SLO ([10](../10-deployment-architecture.md)).
- **−** Cross-provider attribution normalization is non-trivial (fraud/double-count risk) — owned by Affiliate & Attribution ([04 §5.4](../04-system-architecture.md)).

## Rollback
Connectors are enabled/disabled via config + feature flags; a misbehaving connector is disabled instantly and traffic reroutes. The Gateway interface is versioned; connectors pin an interface version.

## Related
[System Architecture §6](../04-system-architecture.md), [API Architecture](../07-api-architecture.md), [ADR-0001](ADR-0001-data-sourcing.md), [ADR-0006](ADR-0006-referral-only-model.md), [ADR-0007](ADR-0007-phased-global-rollout.md).
