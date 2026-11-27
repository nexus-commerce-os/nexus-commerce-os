# The production ingestion runner

A Worker with one cron and no HTTP surface. It runs `runSyncCycle` against
`honesttotal-catalog-prod` twice a day and does nothing else.

It exists because the automation was only ever _scheduled in staging_. The
production database had the schema, the publication machinery and
`auto_publish = 1`; the only Worker in this account with a cron was bound to
the staging database. An authorised merchant feed configured in production
would have sat there indefinitely, and nothing would have said so.

## What a cycle does while nothing is configured

Writes one row to `catalog_sync_cycle` recording that it considered zero
sources. That row is the evidence the schedule fires — an empty cycle log and
a cron that never ran look identical from the outside.

## Activating a merchant — database rows, not a deploy

Two inserts, in this order. The next scheduled cycle picks them up and the
live site reads the new generation on its next request. **No build, no
deploy, no redeploy of honesttotal.com.**

Column names below are the real ones; check them against
`services/catalog/migrations-d1/` before adapting, not against memory.

```sql
-- 1. THE MERCHANT. `relationship` is the gate the publication pipeline
--    actually reads: anything other than 'approved' yields products whose
--    decision is recorded as `merchant_not_approved`, imported but never
--    published. The CHECK on this table also refuses an affiliate_url on a
--    merchant that is not approved, so the tracking link cannot be set first
--    and justified later.
INSERT INTO catalog_merchant
  (id, name, network, advertiser_id, relationship, destination_url, affiliate_url, verified_at)
VALUES ('cj-<merchant-slug>', '<Merchant Name>', 'cj', '<CJ advertiser id>',
        'approved', '<https://merchant.example>', '<the CJ tracking template>',
        '<ISO8601 — when the approval was seen>');

-- 2. THE FEED. `enabled = 0` first: let one cycle retrieve and import it,
--    read the import run and the quarantined rows, and only then enable it.
INSERT INTO catalog_feed_source
  (id, merchant_id, transport, url, format, every_minutes,
   min_interval_minutes, credential_ref, auth_kind, auth_detail, enabled)
VALUES ('src-cj-<merchant-slug>', 'cj-<merchant-slug>', 'https',
        '<the exact feed URL CJ gives you>', 'tsv', 720,
        60, 'CJ_FEED_TOKEN', 'bearer', NULL, 0);
```

Then, once the first import has been inspected:

```sql
UPDATE catalog_feed_source SET enabled = 1 WHERE id = 'src-cj-<merchant-slug>';
```

`catalog_source_permission` is a different thing and is **not** part of this:
it records the source-terms audit per DOMAIN (`verdict` one of `eligible`,
`quarantined`, `unread`) and governs the hand-transcribed catalogue, not an
authorised merchant feed.

### The credential never goes in the database

`credential_ref` holds the NAME of a secret. The value is a Worker secret:

```
npx wrangler secret put CJ_FEED_TOKEN
```

A configuration row gets copied into tickets, backups and dashboards; a secret
in one of those has leaked.

## What cannot be activated this way

- `transport = 'fixture'` is refused outright when the database says
  `environment = 'production'` — by transport, by source id and by merchant
  id. The runner also refuses to start a cycle at all unless the bound
  database identifies itself as production.
- A merchant whose `relationship` is not `approved` is never published: its
  offers are imported and the decision is recorded against each product.
- A product with no fresh offer is withheld as `stale_data` rather than shown
  with an old price.

## Deploying this Worker

```
cd tools/catalog-runner
npx wrangler deploy
```

The `[build]` command compiles `services/catalog` first, because `dist/` is
gitignored and `src/worker.ts` imports it by relative path.

## Checking on it

```
npx wrangler tail --name honesttotal-catalog-runner --format pretty
```

or read the cycle log, which is the durable record:

```
npx wrangler d1 execute honesttotal-catalog-prod --remote \
  --command "SELECT id, outcome, detail, finished_at FROM catalog_sync_cycle ORDER BY started_at DESC LIMIT 5"
```
