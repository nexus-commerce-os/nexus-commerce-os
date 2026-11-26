# The automation pipeline — what runs, what does not, and how fast

**26 November 2026.** Measured, not estimated. Every number here came from a
run on this machine or in CI, and where something is unmeasured it says so.

The target workflow is:

```
scheduled retrieval → feed validation → normalisation → product identification
→ duplicate detection → category classification → database upsert
→ offer reconciliation → price history → publication eligibility
→ search indexing → public website update
```

## Where each stage stands

| # | Stage | State | Where |
|---|---|---|---|
| 1 | **Scheduled retrieval** | **built** — https/API, conditional requests, retry+jitter, SSRF and size guards | `src/retrieval/` |
| 1b | the cron that calls it | **not built** — `runCycle` exists and is tested; nothing invokes it, and it still talks to Postgres rather than D1 | — |
| 2 | Feed validation | built | `catalog-guard.ts`, `freshness.ts` |
| 3 | Normalisation | built — money as integer minor units, never a float | `money.ts` |
| 4 | Product identification | **built** — GTIN-14 first, brand+MPN second, nothing third | `src/product/identity.ts` |
| 5 | Duplicate detection | built, three kinds: identical payload by sha256; repeat rows by identity; one offer per merchant per product | `import-feed.ts`, `product/match.ts` |
| 6 | **Category classification** | **built** — from the merchant's stated path only, never inferred from a title | `src/product/classify.ts` |
| 7 | Database upsert | built on **both** Postgres and D1, one contract suite over each | `postgres-offer-store.ts`, `d1-offer-store.ts` |
| 8 | Offer reconciliation | built | `reconcile.ts` |
| 9 | Price history | built — records movement, not sightings | `reconcile.ts` |
| 10 | Publication eligibility | **built** — default-deny with a recorded reason per product | `src/product/build.ts` |
| 11 | Search | **built** — denormalised `search_text`, folded identically on both sides | `src/public/read.ts` |
| 12 | Public website update | **partial** — the read API exists and an isolated STAGING site serves it; honesttotal.com itself is still on the other lineage and consumes none of it | `src/public/read.ts`, `tools/staging-worker/` |
| 13 | **GTIN/MPN cross-merchant matching** | **built** — and a brand+MPN key claimed by two GTINs is quarantined, not resolved | `src/product/match.ts` |
| 14 | Affiliate link generation | **not built, deliberately** | — |
| 15 | Retry / recovery / monitoring | **partial** — transactional rollback, an import ledger, quarantine, a decision log, structured per-source logs. No alerting. | `scheduler.ts`, `automation/` |
| 16 | **Generation-based publication** | **built** — intervals, a bounded atomic commit, a guarded pointer, rollback, retention | `src/publication/` |
| 17 | **Automatic publication** | **built** — pause, approval gate, cliff guard, dry run, full idempotence | `src/automation/` |
| 18 | Quota-aware execution | **not built** — write costs are measured but nothing budgets against them | — |
| 19 | Admin dashboard and Access JWT | **not built** — and no `/admin` route exists, which a test enforces | — |

**The honest summary: a feed can now be retrieved, validated, reconciled,
persisted, matched into products, classified, judged for publication and made
public through an atomic pointer move — demonstrated end to end against real
Cloudflare D1 and visible on a staging URL. What it still cannot do is run
itself on a schedule against D1, budget its own quota, or be operated by
anybody without a database client.**

## Proven against the real provider exports

Two consecutive authorized CJ Soundcore exports, run locally. The archives are
not in this repository and may not be: they are CJ content and one row carries
a live affiliate tracking URL.

| | |
|---|---|
| first ingestion | **225 products created**, 0 quarantined, freshness `fresh` |
| same bytes again | `applied: false`, run `skipped_duplicate`, store unchanged |
| a later export | 1 added · 1 removed · 183 updated · 41 unchanged · 0 quarantined |
| of the 183 updates: tracking-URL churn only | **147** |
| of the 183 updates: real product changes | **36** |
| store after | 226 — 225 active, **1 inactive with its history kept** |
| price history | **261 rows**, 35 offers with more than one price point |
| failed retrieval | `failed`, carries **no body**, store unchanged |

That churn figure is the reason identity is not keyed on the tracking URL: 147
of 183 daily "changes" are the affiliate wrapper rotating. Keying on it would
retire and recreate most of the catalogue every morning and destroy the price
history the table exists to accumulate.

**This proves the pipeline, not a merchant integration.** `merchants.ts` records
Soundcore as `relationship: 'pending'` with `affiliateUrl: null`, and nothing
publishes a link.

> **Unresolved discrepancy worth the founder's attention.** The repository and
> `provider-access/SOUNDCORE-CJ-COMPLIANCE.md` (last verified 10 Aug 2026) both
> say the CJ application is **PENDING**. A later note elsewhere records approval
> on 3 Sep 2026. These cannot both be current. Nothing was changed on the
> strength of either — links stay disabled until the live CJ UI says otherwise.

## Scale, measured

Synthetic data only: fictional "Northwind Trading" products on `example.invalid`.
Nothing here describes a real merchant's catalogue.
Reproduce with `node scripts/benchmark-ingestion.mjs 1000 10000 100000`.

| rows | first import | rows/sec | re-import (every price moved) | peak RSS |
|---|---|---|---|---|
| 1,000 | 29 ms | 34,000 | 35 ms | 61 MB |
| 10,000 | 193 ms | 52,000 | 276 ms | 209 MB |
| 100,000 | 2.6 s | 38,000 | 4.4 s | **982 MB** |

**The benchmark found a real bug on its first run.** Before the fix those
numbers were 41 ms / 1,070 ms / **149,316 ms** — 10× the rows for 140× the
time, the signature of an n² loop. `appendPriceHistory` enforced
`offer_price_history_once_per_run` by rescanning the whole history array for
every entry. It is a Set now: **57× faster at 100k, 87× on re-import.**

Scope, stated plainly: that was the **in-memory store**, which is a test double.
The Postgres adapter enforces the same rule with a unique index and was never
affected. No production path was slow — but a benchmark run against a quadratic
test double measures the double, and its first conclusion ("this cannot reach
100k products") was false.

### The limit that is still real

**982 MB at 100,000 rows.** The importer builds every offer in memory before
the write phase, and the in-memory store then holds the whole catalogue. That
is acceptable at 100k and **will not reach 1,000,000**:

| target | verdict |
|---|---|
| 1,000 | comfortable |
| 10,000 | comfortable |
| 100,000 | works; memory is the constraint, not time |
| 1,000,000 | **needs streaming parse and batched writes** — an architecture change, not a tuning pass |

Nothing here loads the catalogue to serve a page, and no price update rebuilds
the site, because nothing serves it yet — stage 12 is unbuilt. That constraint
has to be honoured when it is.

## What should happen next, in order

1. **The cron that calls `runCycle`, against D1.** The retrieval loop is built
   and tested, and automatic publication is built and tested — but nothing
   invokes either on a schedule, and `runCycle` still writes to Postgres. This
   is the one remaining gap between "works when run" and "runs".
2. **Quota-aware execution.** The costs are measured (`d1-database.md`): about
   12 writes per new offer, 6 for an unchanged feed, and roughly 4 per staged
   candidate per cycle. Nothing budgets against them yet, and the free tier
   allows 100,000 writes a day.
3. **Cloudflare Access JWT verification, then the admin dashboard** — in that
   order. The dashboard's job is to control and monitor this pipeline, and an
   unauthenticated control surface for a data pipeline is worse than none.
4. **Connect honesttotal.com to the read API** (12). `main` holds the services
   and the staging site; the deployed website lives on
   `release/product-catalog` and consumes none of it. The two lineages have
   different data flows, so this is a design step and not a merge — and
   `PublicCatalogue` exists precisely so that whatever connects them does not
   write its own interval filter.
5. **Authorised merchant data.** Everything above is demonstrated on fixtures.
   Soundcore remains PENDING and disabled, and the source-terms audit found 2
   of 10 records eligible — in different categories, so comparison cannot be
   built on them. No amount of pipeline work changes that; it needs a provider
   relationship.

## Demonstrated on staging, 26 Nov 2026

`https://honesttotal-catalog-staging.samsuzzaman.workers.dev` — bound to
`honesttotal-catalog-staging`, no custom domain, no route, no KV, noindex, and
its only write endpoint is refused when the secret is unset.

| cycle | result |
|---|---|
| 1 | three fixture merchants, 19 products, 15 eligible, 4 withheld (pending merchant) → generation 1, 15 opened |
| 2 | identical feeds → `skipped_duplicate`, 0 opened, 0 closed, 15 unchanged, **0 decisions re-recorded** |
| 3 | one price change, one new product → 1 opened, 9 refreshed, 16 public |
| 4 | one new product → generation 5, 17 public |

The page showed 16 products, then 17, while the Worker version id stayed
`c8ceab8a`. **No rebuild, no deploy, no cache to invalidate.**

Cycle 4's first attempt was refused by the cliff guard, correctly: it re-ran
only one merchant's feed, so another merchant's offers aged past 48 hours and
5 of 16 products would have vanished.
