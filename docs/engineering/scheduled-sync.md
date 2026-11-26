# Scheduled synchronisation — what runs on a timer, and what stops it

## What was actually missing

`runCycle` was built and tested long before this. So was `publishCatalogue`.
What did not exist was anything that **called** either on a timer — and a
retrieval loop nothing invokes is not automation, however well it is tested.

That is now a Cloudflare scheduled trigger, and the cycle it runs reads its
sources from the database rather than from a deploy.

## The order is the design

1. **Is automation paused?** Checked before anything is read, so a paused
   system does no work and spends no quota.
2. **Is there budget?** Checked before anything is written.
3. **Retrieve and import**, per source, failures isolated.
4. **Publish** — one atomic pointer move.
5. **Record the cost and the health**, including when the answer at step 1 or
   2 was "no".

**A cycle that was refused is still recorded.** A scheduler that writes a row
only when it succeeds looks exactly like one that never fired, and "did the
cron run?" is the first question anybody asks.

## Two separate off switches

| switch | meaning |
|---|---|
| `catalog_automation_config.paused` | the whole system. One row, in the database, so stopping automation never needs a deploy |
| `catalog_feed_source.enabled` | **configuration** — this source is not ready |
| `catalog_feed_source.paused` | an **operator action**, with a reason and a timestamp — this source *was* running and somebody stopped it |

Collapsing `enabled` and `paused` into one boolean loses the question an
incident review always asks: was this off on purpose, and who turned it off?
Pausing without a reason is refused in code and by a CHECK constraint.

Both are filtered in SQL, so a paused source costs no retrieval, no credential
lookup and no quota — and so a caller cannot forget the filter.

## The daily write budget

The free tier allows **100,000 rows written per day**, resetting at **UTC
midnight**. Exceeding it does not degrade: writes start failing and an import
stops half-way. That is recoverable, because publication is a separate pointer
move and a half-written import is staged rather than published — but it is a
bad way to learn what a feed costs.

### Estimated and authoritative are not the same number

| | what it is | how it is wrong |
|---|---|---|
| **estimated** | counted from `meta.rows_written` on this process's own statements | blind to a migration, another Worker, an operator with a database client |
| **authoritative** | Cloudflare's own figure | **lags**, because analytics are aggregated |

The budget spends **the higher of the two**. That is the only reading wrong in
the safe direction: it can refuse a cycle that would have fitted, and it
cannot permit one that would not. Budgeting against the lagging number alone
would spend the same allowance twice.

They are stored in separate columns, and `authoritative_writes` is NULL until
somebody has asked — NULL meaning *not known*, which is not zero.

### Three limits, not one

- `dailyWrites` — the allowance.
- `maxCycleFraction` (10%) — one cycle's share. Without it, a single large
  first import consumes the day and every later cycle, including the cheap
  ones that keep existing products fresh, is refused until midnight.
- `reserve` (5,000) — held back for publication and for the operator. Running
  out of writes with a generation staged and no allowance to move the pointer
  is the one state worth engineering around.

The budget is re-checked **after** retrieval and before publication, because a
first import can cost far more than the estimate the cycle started with.

### The meter counts; it does not enforce

`CycleMeter` is a counter, and deliberately not an enforcer: it cannot stop a
statement mid-flight, and pretending otherwise would be a guarantee that reads
as true and is not. What it gives the caller is the moment to stop starting new
work — checked *between* sources, never mid-import.

It reads `rows_written`, falling back to `changes` when a transport does not
report it. That fallback matters: reading a missing field as **zero** would
make a busy cycle appear free, and a budget that believes it has spent nothing
is no budget at all. An undercount refuses too late; a zero never refuses.

### `meteredD1` is a Proxy

The first version returned a rebuilt `{bind, all, run, first}` literal and
broke both test harnesses: each transport keeps its own internals on the
statement — `__exec` on the SQLite one, `__send` on the HTTP one — and a
rebuilt object dropped them. A real `D1PreparedStatement` is a class instance,
so a spread would lose its prototype methods for the same reason. Intercepting
only the three calls that carry `meta` leaves everything else untouched.

## Source health

`consecutive_failures` is incremented on a failure and **reset to zero on any
non-failure**, so "broken since Tuesday" and "failed once an hour ago" are
different numbers rather than the same boolean. It lives on the source row
rather than being derived from the cycle log, because the question is asked on
every dashboard load and the log grows forever.

## Conditional requests

The stored `etag`, `last_modified` and `payload_sha256` are written back with
`COALESCE`, not assignment. A 304 means *unchanged*, and the scheduler reports
it with no new ETag — overwriting the stored one with NULL would make the next
request unconditional, so the saving that conditional requests exist for would
evaporate after the first 304.

## The schedule

`17 2,14 * * *` — twice a day, twelve hours apart. The `:17` is deliberate:
everything scheduled on the hour contends with everything else, and a
provider's export is not ready at exactly midnight either.

The cycle id is derived from the instant, and the insert upserts, so a cron
that fires twice updates one row rather than running twice.

`waitUntil` is **not** used to detach the work. A scheduled Worker may run to
completion, and detaching would make the cron report success the instant it
starts — exactly the lie a log is supposed to prevent.

## `nodejs_compat` is required, and was found by deploying

The ingestion path uses `node:crypto` for run ids and `node:zlib` to read a
ZIP, so the first deploy of the scheduled handler refused to start:
`Dynamic require of "node:crypto" is not supported`. Workers provides both
under `compatibility_flags = ["nodejs_compat"]`.

It is a real dependency and is written down as one. Rewriting the archive
reader around `DecompressionStream` and swapping `randomUUID` for the global
`crypto` is a worthwhile change and **not** one to make while proving the
scheduler works — it would mean the feed parser measured against seven real
provider exports is no longer the one being run.

## The synthetic provider

The `fixture` transport reads a local file and is **refused unless the caller
passes `allowFixtures`** — correctly, because a fixture must never retrieve in
production. A scheduled cycle pointed at a fixture source would therefore
prove only that the cron fired.

So the staging Worker serves the same synthetic bytes over **real https** at
`/fixture/<merchant>.zip`, and the sources use `transport: 'https'`. The
scheduled cycle then exercises the real path: the SSRF guard, conditional
requests, the size limits, the ZIP reader, the freshness guard, reconciliation
and publication. Nothing about the pipeline is stubbed; only the provider is.

Its ETag is derived from the hour, so an unchanged feed answers **304** and the
cycle costs nothing — the behaviour the design depends on, exercised rather
than simulated. Every product is named `(FIXTURE)` and every merchant id starts
with `fixture-`, so a row that escaped into a real catalogue would be obvious
rather than plausible.

Shipping columns are left **empty**, exactly as the measured provider export
leaves them. Filling them would invent a delivered cost and make the staging
site claim totals the real pipeline cannot.
