# Publication — how a computed catalogue becomes a visible one

## The problem

`applyRun` is not atomic on D1. There is no transaction spanning batches, and
an interrupted import **measurably leaves its committed writes behind** — ten
of ten offers survived a simulated mid-flush failure in
`services/catalog/test/d1-remote.test.mjs`. Nothing rolls them back.

That is survivable for one reason only: nothing public reads the import tables.
Something still has to make a catalogue visible, and that something must be
atomic, or a half-finished import becomes a half-finished website.

This is that step. It moves **one row**.

## Why intervals, and not copies

The obvious designs are a table per generation, or a `generation` column on
every published row. Both rewrite the entire published catalogue on every
synchronisation.

Measured against that: a published product costs about 5 `rows_written`
(the row plus its index entries), and the free tier allows 100,000 writes a
day. Copying a 20,000-product catalogue twice a day would spend the whole
budget restating that nothing had changed.

So a published row carries the **interval of generations it is valid for**:

| column | meaning |
|---|---|
| `first_generation` | the generation that published it |
| `last_generation = NULL` | still published |
| `last_generation = N` | published through `N`, gone from `N+1` |

A reader resolves the pointer once and then filters:

```sql
WHERE first_generation <= :live
  AND (last_generation IS NULL OR last_generation >= :live)
```

Publishing therefore costs **one write per change and nothing per unchanged
product**. Measured on real D1: publishing five products cost 75
`rows_written`; republishing the identical catalogue rewrote **no published
rows at all**.

## What makes it atomic

The expensive half — opening and closing interval rows — is deliberately
**outside** the atomic unit, and that is safe for a precise reason:

- a row opened at generation `N` has `first_generation = N`, and a reader at
  live generation `L < N` requires `first_generation <= L`. **Invisible.**
- a row closed for generation `N` has `last_generation = L`, and a reader at
  `L` requires `last_generation >= L`. **Still visible.**

Neither phase changes what the public sees. Both may be interrupted, resumed,
or run twice. What must be atomic is only:

1. mark the generation `live`,
2. mark the previous one `superseded`,
3. move the pointer.

Three statements, one batch, regardless of catalogue size. **An unbounded
amount of work made safe by a bounded commit.**

### The pointer move is guarded

```sql
UPDATE catalog_publication_pointer
   SET live_generation = ?
 WHERE id = 1 AND live_generation = :expected
```

If that changes zero rows, somebody else moved it — a second publisher, or an
operator rolling back — and finishing would discard their decision in silence.
The publisher raises `PointerMovedError` instead.

### The commit's atomicity is Cloudflare's claim, not our measurement

A `batch()` is documented as atomic. This repository has **not verified it**:
the D1 HTTP API refuses bindings alongside multiple statements
(`code 7400`), so the remote suite cannot express a batch at all.

Rather than trust that at the one point where the public catalogue changes,
the publisher **handles the half-committed state**. If a generation says
`live` while the pointer says otherwise, the commit started and did not
finish, so it is finished rather than rejected. Without that branch the state
is permanent: validation refuses anything that is not `building`, so the
generation could neither be published nor rolled back to, and the only repair
would be hand-editing production.

## Concurrency

`publication_one_building` is a partial unique index over `status = 'building'`.
**At most one generation can be under construction**, enforced by the database
rather than by a lock a dead process could hold forever. Verified on real D1,
not just written down.

Because of that, two publishers can never race. The only thing that moves the
pointer mid-publish is an **operator rolling back**, which is also why a
rollback marks a `building` generation `rolled_back`: an operator who has
decided to return to an older catalogue has decided against the one being
built.

## Validation — what a generation must satisfy

| refusal | why |
|---|---|
| `not_building` | only a generation under construction can be published |
| `unknown_generation` | no such generation |
| `empty_catalogue` | **an import that retrieved nothing produces exactly this.** Refused unless the caller states that an empty catalogue is intended |
| `catalogue_cliff` | more than 20% of the published catalogue would disappear |

The cliff limit is **chosen, not measured** — there is no history to measure
against yet — and deliberately not 100%, because a limit that permits anything
is not a guard. Operators can widen it per call for a known large retirement.

Together these are "never retire existing products merely because feed
retrieval failed". Growth is never a cliff, however large.

## Rollback

Nothing is deleted when a generation supersedes another. Rows closed at `L` are
still inside the interval a reader at `L` asks for, so **moving the pointer back
restores exactly the catalogue that was live** — without reconstructing it.

After the pointer moves back, the rows the discarded generations *opened* are
deleted. They are already invisible, so the site is correct before the cleanup
runs — but they cannot be left, because each still occupies a slot in
`published_product_open`, and one rollback would otherwise block every future
publication of those products. The same applies to `abandon()`.

A generation that was rolled back cannot be returned to: the rows it opened are
gone, so pointing at it again would serve a catalogue that no longer exists.

## Retention

`prune({ keep, maxDeletes })` deletes generations older than the ones kept for
rollback. `keep` must be at least 1 — keeping none would delete rollback — and
`maxDeletes` is a hard cap, because cleanup that could consume the daily write
budget is not cleanup. The live generation is never touched, and neither is any
generation an interval row still references.

## Known scaling boundary, measured

Staging candidates costs writes even when nothing is published: republishing
an identical five-product catalogue cost **26 `rows_written`**, all of it
candidate rows and the commit. That is roughly 4 writes per candidate per
cycle, independent of whether the product changed.

At two cycles a day on the free tier's 100,000 writes, candidate staging alone
becomes the binding constraint somewhere around **12,000 products** — long
before the published intervals do, because those cost nothing when unchanged.

The fix, when that matters, is to stage only candidates that differ from the
live published row and derive the eligible count from the live catalogue
instead of from the staged rows. It is not done yet, and at the current
catalogue size it would be optimising something that costs 26 writes a day.

## Where this is tested

| file | what it covers |
|---|---|
| `test/publication.test.mjs` | 23 tests on a real SQL engine: the rules, the diff, crashes immediately before and after the commit, the half-landed commit, abandon, rollback, rollback-then-publish, retention |
| `test/d1-remote.test.mjs` | the same design against **real Cloudflare D1**: that `publication_one_building` is a real mutex, that `published_product_open` is a real invariant, that an unchanged republication writes nothing, that a failed feed cannot empty the catalogue, and that rollback restores byte for byte |

## Applied

Migration `0003_publication_generations.sql` is applied to all three
databases (26 Nov 2026), each verified identical afterwards: 21 tables, 55
indexes, pointer unset, nothing published.

The previous `catalog_published_product` was replaced rather than migrated —
it was keyed on `product_id` alone, which cannot hold two generations of one
product. All three databases measurably held **zero** published rows when that
ran, so nothing was preserved because there was nothing to preserve.
