# Cloudflare D1 — provisioned environments, verified limits, and the quota maths

**26 November 2026.** Limits below were read from Cloudflare's own
documentation on the day (pages dated 2026-10-30 and 2026-11-20), not recalled.
Where a figure could not be verified it says so.

## What exists

| Environment | Database | ID | Tables |
|---|---|---|---|
| development | `honesttotal-catalog-dev` | `a6cde15a-f043-4584-a385-e717a4123e62` | 17 |
| staging | `honesttotal-catalog-staging` | `94d3893d-fc34-44cd-b8a3-31027cdfb79f` | 17 |
| production | `honesttotal-catalog-prod` | `26b88f39-a560-4e31-97be-db48faee97cb` | 17 |

All three in region APAC. The pre-existing `ictzaman-fb-publisher` database
belongs to a different project and is untouched. **The production waitlist KV
namespace is untouched** — D1 is additional storage, not a replacement.

A database id is not a secret: it identifies a database, and access is by
account credential. It is recorded here so the bindings are auditable.

## The limits that actually shape the design

Free plan, verified:

| | Free | Paid, for contrast |
|---|---|---|
| databases per account | **10** | 1,000,000 |
| size per database | **500 MB** | 10 GB (cannot be raised further) |
| storage per account | **5 GB** | 1 TB |
| rows read / day | **5,000,000** | 25bn/month included |
| rows written / day | **100,000** | 50m/month included |
| **queries per Worker invocation** | **50** | 1,000 |
| Time Travel retention | **7 days** | 30 days |

Daily counters reset at 00:00 UTC. Over the read/write limit queries fail until
reset; over the storage limit you must delete before inserting.

Per query: 30 s maximum duration, **100 bound parameters**, 100 KB statement
length, 50 MB result size, 2 MB per row/BLOB, 100 columns per table.

### Two of those decide the architecture

**50 queries per Worker invocation** means a Worker cannot ingest a feed. A
225-row import is hundreds of statements. So:

- **ingestion runs in Node** (GitHub Actions today), writing over the D1 HTTP
  API, where the per-invocation cap does not apply;
- **the Worker only reads**, and a page view must cost a handful of indexed
  queries, not one per product.

That is why `catalog_published_product` denormalises title, brand, category and
search text: a listing page must not need a join per row.

**100,000 rows written per day** is the real ceiling on catalogue size, not the
500 MB. One full import of 225 offers writes roughly 500 rows. A daily refresh
of 10,000 products would write ~20,000 rows and fit; 100,000 products refreshed
daily would not. Incremental sync is therefore not an optimisation here, it is
the thing that makes the free tier viable: reconciliation already writes only
what changed, and on two real consecutive exports that was 183 of 225 rows —
and 147 of those 183 were tracking-URL churn.

## Transactions, and what D1 does not have

D1 **operates in auto-commit**. Explicit `BEGIN`/`COMMIT` through the query API
is **not supported** — the import documentation tells you to strip them from
dumps. Atomicity comes from `batch()`, which the docs state is a transaction and
which rolls the whole sequence back on failure.

This matters for the storage contract: the Postgres adapter wraps the write
phase in `withTransaction`. The D1 adapter must express the same unit of work as
one `batch()`, and the **100-bound-parameter limit** means a large write phase
becomes several batches — which is *not* equivalent, and the adapter has to say
so rather than pretend.

Foreign keys are enforced by default and cannot be switched off per query;
`PRAGMA defer_foreign_keys` defers violations to the end of a transaction.
Parents are therefore written before children.

## Backup and recovery

**Time Travel**, always on, no setup, free: restore to any minute in the last
**7 days** on the free plan.

```
npx wrangler d1 time-travel info honesttotal-catalog-prod
npx wrangler d1 time-travel restore honesttotal-catalog-prod --timestamp=<unix>
```

A restore is **destructive and in place** — it overwrites the database and
cancels in-flight queries — and returns a bookmark so the restore itself can be
undone. Beyond 7 days there is no retention on the free plan, so anything that
must outlive a week needs an export to R2. That is not set up, and pretending
Time Travel is a backup strategy past 7 days would be wrong.

`wrangler d1 export <db> --remote --output=f.sql` produces a portable dump.

## Portability is kept deliberately

The Postgres implementation **stays**. Both engines implement the same storage
interface and the same contract suite runs against each, because D1's free tier
is a starting line and not a destination. The migration path out:

1. `wrangler d1 export` produces SQLite-dialect SQL;
2. the type differences are known and small — booleans are `INTEGER 0/1`,
   timestamps and UUIDs are `TEXT`, money is `INTEGER` minor units in both;
3. the contract suite is what proves the new engine behaves, so a move is a
   adapter plus a green suite rather than an archaeology project.

**Do not assume one D1 database scales indefinitely.** At 500 MB per database
and 100k writes a day, the first thing to break will be the write budget, and
the answer then is either a paid plan or Postgres — not a second free database,
because splitting a catalogue across databases breaks every cross-merchant
query the product exists to serve.

## Migrations

Plain SQL under `services/catalog/migrations-d1/`, applied with
`wrangler d1 execute <db> --remote --file=<f>`. Numbered, and written so
re-running them is safe (`IF NOT EXISTS`, `INSERT OR IGNORE`).

Applied to dev first, verified, then staging and production.

### Constraints verified against the live database, not just written down

| attempted | result |
|---|---|
| `affiliate_url` on a `pending` merchant | **refused** — `CHECK constraint failed: affiliate_url IS NULL OR relationship = 'approved'` |
| verified shipping cost with no destination | **refused** — `CHECK constraint failed: shipping_verified = 0 OR (...)` |
| a paused feed source with no reason | **refused** — `CHECK constraint failed: paused = 0 OR paused_reason IS NOT NULL` |

The first is the one worth keeping: an affiliate link for an unapproved
merchant is now impossible to store, so the rule cannot be forgotten at a call
site.

## Transport behaviour, measured against a live database

The contract suite runs the adapter on `node:sqlite`, which is fast and free
but cannot speak for the platform. Its own header lists three things it does
not know. `services/catalog/test/d1-remote.test.mjs` answers them by asking
Cloudflare: it creates a throwaway database, applies the real migrations, runs
the real adapter, and deletes the database afterwards. Every line below was
measured on 26 Nov 2026 against `v3-prod` in APAC/SIN before it was written
down, and each is now an assertion rather than a note.

| asked | what D1 actually did |
|---|---|
| 100 bound parameters | accepted |
| 101 bound parameters | **HTTP 400**, `code 7500`, `too many SQL variables` |
| bound parameters with two statements in one request | **HTTP 400**, `code 7400`, `params with multiple statements is not supported` |
| two statements in one request, second violates a `UNIQUE` | **both rolled back** — the first did not survive |
| offer referencing a run that does not exist | **refused** — `FOREIGN KEY constraint failed` |
| `PRAGMA foreign_keys` | `1`, and setting it changes nothing |
| second row with the same `(merchant_id, merchant_offer_id)` | **refused** — `UNIQUE constraint failed` |
| second `applied` run with the same content hash | **refused** — the partial unique index is the arbiter |
| `ON CONFLICT (merchant_id, merchant_offer_id)` upsert | lands on the existing row |

Two of these change the code rather than merely confirming it.

**`MAX_BOUND_PARAMS = 100` is the platform's number.** `d1-client.ts` chunks
every multi-row write by parameter count because of the 400 above, not because
100 seemed prudent. A 27-column offer therefore fits three rows per statement.

**The HTTP API cannot carry bindings alongside multiple statements**, so the
remote harness's `batch()` is a sequence of separate requests and is *not*
atomic. That makes it strictly weaker than a Worker's D1 binding, which is the
only reason it is acceptable as a test transport: a contract that holds under a
non-atomic batch also holds under an atomic one. A harness that invented
atomicity the real binding lacked would be the dangerous direction.

### The write cost of an import, which is what the daily budget is made of

`rows_written` counts index entries, not just table rows — an offer row with
four applicable indexes reports 5. Measured end to end, through the real
adapter:

| cycle | `rows_written` |
|---|---|
| 25 new offers (first import) | **307** (~12.3 per offer: offer row + indexes, price-history row + index, ledger) |
| the identical feed again | **6** — refused on the content hash before any catalogue write |
| one price change + one new offer | **173** |
| three full cycles, feed bytes to a published catalogue, 4 then 5 products | **380** (243 rows read, 149 HTTP requests) |

The first figure was 282 before migration `0004` added `product_type` and its
partial index; that index is why it moved. The number is re-measured by the
test rather than pinned, so an index change shows up as a changed log line
instead of a failure.

The free tier allows 100,000 writes per day. At ~11 writes per new offer, a
full first import of a 225-offer merchant feed costs roughly 2,500 — about 2.5%
of a day's budget. The number that matters for growth is the second row: an
unchanged feed costs 6 writes regardless of catalogue size, because the content
hash is checked first. Change detection is therefore the quota strategy, not an
optimisation on top of one.

### What an interrupted import leaves behind

Measured, not reasoned about: when the flush fails part-way, the statements
already sent **stay committed**. D1 gave `applyRun` no transaction spanning
batches, so nothing undoes them. The run is left un-`applied`, and re-running
the same feed converges on the full catalogue with no duplicates — every
statement is an identity-keyed upsert and price history carries a
once-per-run unique index.

This is safe only because nothing public reads these tables. Publication is a
separate pointer move, so a half-written import is **staged, not published**.

## Not verified

- maximum rows returned per query (not listed in the docs);
- whether `PRAGMA defer_foreign_keys` applies inside `batch()`;
- migration file-count and size limits;
- **real `batch()` atomicity.** The HTTP API cannot express it, so it is
  unproven by the remote suite. It is exercised from inside a Worker as part
  of the staging demonstration; until then, treat the atomicity of a single
  `batch()` as Cloudflare's documented claim rather than as something this
  repository has measured.
