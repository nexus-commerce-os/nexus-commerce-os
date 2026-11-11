# services/catalog — Catalog & Offer

**Status:** P0.3 increment 1 — offer schema, authorized-feed adapter and validation guard implemented. No ingestion scheduler, persistence, API or UI wiring.
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

## What is implemented (increment 1)

| module | responsibility |
|---|---|
| `src/money.ts` | integer minor-units money; decimal **string** to integer, never via a float (NFR-CONS-01) |
| `src/offer.ts` | canonical `Offer`, `ShippingCost`, `MandatoryFees`, delivered cost, ranking eligibility |
| `src/feed/cj-shopping-feed.ts` | adapter for the CJ *Shopping (Google Format)* export — parsing only, no judgement |
| `src/catalog-guard.ts` | the only route from a feed row to an `Offer`; default-deny validation and de-duplication |

### The invariant

**Shipping the provider did not state stays `MISSING`. It is never zero.** The
type enforces it: the `MISSING` variant carries no `Money`, so there is no
`shipping.cost` for anyone to default. A `VERIFIED` cost can only come from
`verifiedShipping()`, which requires a destination country and an evidence
string. An offer whose delivered cost is not fully verified is never eligible
for delivered-price ranking.

This is not hypothetical. The Soundcore export measured on 29 Oct 2026 carries
**no shipping value in 227 of 227 records** — see
[`provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md`](../../provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md).

## Scope guard

**Not implemented:** ingestion scheduling, persistence, read projections, HTTP
endpoints, affiliate links, and any wiring into `apps/web`. Nothing here is
imported by the web app yet.

**No provider data in this repository.** Raw CJ feeds and real merchant product
records are provider content under the network's terms and this repository is
public. Tests run entirely on invented products in `test/fixtures/`; only the
feed's *schema* — column names and the `"79.99 USD"` money format — is mirrored
there, because a fixture with tidier columns than the provider sends would test
a feed nobody receives.

## Tests

```
pnpm --filter @nexus/catalog test
```

Compiles with `tsc` and runs Node's built-in test runner against `dist/`, so the
suite exercises the artifact other packages import. No test-runner dependency is
added — the same reasoning as [`apps/web/scripts/verify-merchants.mjs`](../../apps/web/scripts/verify-merchants.mjs).
Test files are listed explicitly in the `test` script because directory and glob
arguments to `node --test` are not portable across the Node versions in use.
