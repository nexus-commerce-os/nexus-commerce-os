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

## Not verified

- maximum rows returned per query (not listed in the docs);
- whether `PRAGMA defer_foreign_keys` applies inside `batch()`;
- migration file-count and size limits.
