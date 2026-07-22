# services/catalog — Catalog & Offer

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/commerce` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/catalog/`)
**Runtime / language:** TypeScript (NestJS) — core product API ([SDD §6 — Backend core](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** **Catalog & Offer** bounded context ([SDD §3](../../docs/02-software-design-document.md#3-domain-model-bounded-contexts), [04 §4](../../docs/04-system-architecture.md#4-component-responsibilities)) — canonical offer schema, offer/product read models
**Governing ADRs:** [ADR-0001](../../docs/adr/ADR-0001-data-sourcing.md) (authorized-sources-only; license-tag enforcement), [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (adapter boundary — no provider SDK in core), [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (own schema/role; CQRS read models)
**Implemented by phase:** [P0.3 — Commerce Foundation](../../docs/13-implementation-roadmap.md) (Product Catalog fed by authorized feeds)

## Purpose

Owns the canonical offer/product model and the read-optimized catalog projections consumed by Search and Price Intelligence. Offers arrive only through the **authorized** feed-ingestion boundary ([04 §5.2](../../docs/04-system-architecture.md#52-event-driven-feed-ingestion-the-legitimacy-boundary)); every record is **license-tagged** at the adapter — the catalog never sources data by scraping. Monetary fields use the canonical money type (integer minor-units + ISO currency, NFR-CONS-01).

## Dependencies

- `packages/shared`, `packages/config`
- Data: PostgreSQL (own schema) + object store, sharded; hot paths may move to a wide-column store ([SDD §6](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives), [06](../../docs/06-database-architecture.md))
- Upstream: Feed Ingestion (Go) via Kafka `offer.upserted` — event-driven, not a sync call

## Scope guard

Scaffold only — **no offer schema, no ingestion, no queries, no endpoints.** `src/` documents intent for P0.3.
