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
| 1b | the cron that calls it | **not built** — `runCycle` exists and is tested; nothing invokes it yet | — |
| 2 | Feed validation | built | `catalog-guard.ts`, `freshness.ts` |
| 3 | Normalisation | built — money as integer minor units, never a float | `money.ts` |
| 4 | Product identification | **partial** — identity is `(merchant_id, merchant_offer_id)` | `offer-store.ts` |
| 5 | Duplicate detection | built, two kinds: identical payload refused by sha256; repeat rows by identity | `import-feed.ts` |
| 6 | **Category classification** | **not built** | — |
| 7 | Database upsert | built, transactional | `postgres-offer-store.ts` |
| 8 | Offer reconciliation | built | `reconcile.ts` |
| 9 | Price history | built — records movement, not sightings | `reconcile.ts` |
| 10 | Publication eligibility | **not built** for feed products (the hand-transcribed catalog has its own gate) | — |
| 11 | Search indexing | **not built** | — |
| 12 | Public website update | **not built** — the feed pipeline is on `main`, the website on `release/product-catalog`, and nothing connects them | — |
| 13 | **GTIN/MPN cross-merchant matching** | **not built** — prerequisite for multi-merchant comparison | — |
| 14 | Affiliate link generation | **not built, deliberately** | — |
| 15 | Retry / recovery / monitoring | **partial** — transactional rollback, an import ledger, quarantine, structured per-source logs. No alerting. | `scheduler.ts` |

**The honest summary: the pipeline can now go and get a feed, validate it,
reconcile it and persist it with history. It cannot yet classify what it finds,
match the same product across two merchants, decide publication for feed
products, or put any of it on the website.**

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

1. **The cron that calls `runCycle`** — a Cloudflare scheduled trigger. The
   loop is built and tested; nothing invokes it. This is the smallest step from
   "can retrieve" to "does retrieve".
2. **GTIN/MPN matching across merchants** (13) — the prerequisite for
   multi-merchant offers and for ranking to mean anything.
3. **Category classification** (6) and **publication eligibility for feed
   products** (10).
4. **Auth and RBAC, then the admin dashboard** — in that order. The dashboard's
   job is to control and monitor this pipeline, and an unauthenticated control
   surface for a data pipeline is worse than none.
5. **Connect the lineages** (12). `main` holds the services; the deployed site
   lives on `release/product-catalog` and consumes none of it. The two have
   different data flows, so this is a design step and not a merge.
