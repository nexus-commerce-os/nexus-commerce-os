-- =============================================================================
-- catalog · 0001 · initial schema
--
-- Owns every table of the Catalog bounded context and NOTHING else: this
-- context lives in its own Postgres schema under its own DB role (docs/06 §4,
-- ADR-0020), which turns the architectural boundary into a database
-- permission. CI greps these files for cross-schema DDL — keep every statement
-- inside `catalog`.
--
-- Role grants are infrastructure's job (Terraform), not this migration's.
--
-- WHY POSTGRES AND NOT D1. The certified architecture puts each bounded context
-- in its own Postgres schema under its own role, with a `schema_migration`
-- ledger (docs/06 §4, ADR-0020); this is the first migration in the repository
-- and it follows that rule. Feed ingestion is a batch job that reads an archive and
-- writes history — it is not on the Worker request path, so the one argument
-- for D1 (it is what a Worker can reach) does not apply, while the arguments
-- against a second engine (a second dialect, a second migration runner, a
-- second backup story) all do.
--
-- WHAT THIS SCHEMA REFUSES TO STORE. No CJ credential, and no affiliate
-- tracking URL in any history or quarantine row. `merchant_offer` holds the
-- current tracking URL because serving a link is its purpose; nothing else
-- keeps a copy, so a dump of the history or the quarantine cannot leak one.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS catalog;

-- Applied-migration ledger. The runner writes here; nothing else does.
CREATE TABLE IF NOT EXISTS catalog.schema_migration (
  version     text        PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ── import runs ─────────────────────────────────────────────────────────────
-- One row per attempted import, written BEFORE the work starts and completed
-- after, so a crashed run is visible as `started` rather than missing.
--
-- `content_sha256` is what makes an import idempotent: the same export, fed in
-- twice, is recognised by the bytes of its delimited payload rather than by
-- its filename or its modification time, both of which a re-download changes.
CREATE TABLE catalog.import_run (
  id                 uuid        PRIMARY KEY,
  merchant_id        text        NOT NULL,
  source_feed        text        NOT NULL,
  -- sha256 of the extracted delimited text, lower-case hex.
  content_sha256     text        NOT NULL,
  -- The provider's own generation stamp, read from the feed, not the file.
  feed_exported_at   timestamptz NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz NULL,
  status             text        NOT NULL,
  -- Reconciliation counters, null until the run finishes.
  rows_total         integer     NULL,
  offers_added       integer     NULL,
  offers_removed     integer     NULL,
  offers_updated     integer     NULL,
  offers_unchanged   integer     NULL,
  rows_quarantined   integer     NULL,
  -- Why a run ended without applying anything. Never holds feed content.
  skip_reason        text        NULL,
  CONSTRAINT import_run_status_known
    CHECK (status IN ('started', 'applied', 'skipped_duplicate', 'skipped_stale', 'failed'))
);

-- A given export is applied at most once per merchant. A second attempt is
-- recorded as `skipped_duplicate` with a different id, so the ledger shows the
-- re-import happened and shows that it changed nothing.
CREATE UNIQUE INDEX import_run_applied_once
  ON catalog.import_run (merchant_id, content_sha256)
  WHERE status = 'applied';

CREATE INDEX import_run_recent ON catalog.import_run (merchant_id, started_at DESC);

-- ── merchant offers ─────────────────────────────────────────────────────────
-- Identity is (merchant_id, merchant_offer_id) and nothing else. The feed's
-- LINK, IMPRESSION_URL and LAST_UPDATED all change on most rows of every
-- export — measured on the 9→10 November pair: 178, 224 and 224 of 224 common
-- products — so treating any of them as identity would churn the whole
-- catalogue daily and destroy the price history it exists to keep.
CREATE TABLE catalog.merchant_offer (
  -- `<merchant_id>:<merchant_offer_id>`, which is what Offer.offerId already
  -- is. There is deliberately NO surrogate uuid: the key would be derived from
  -- the two columns the UNIQUE constraint below already covers, so it would
  -- add a second name for one thing and an extra lookup on every upsert.
  -- (This column WAS `uuid` until the Postgres adapter was written; nothing
  -- generates a uuid for an offer, so every insert would have failed. The
  -- in-memory adapter could not catch it because it stores strings.)
  id                  text        PRIMARY KEY,
  merchant_id         text        NOT NULL,
  -- The merchant's own SKU, verbatim.
  merchant_offer_id   text        NOT NULL,

  gtin                text        NULL,
  mpn                 text        NULL,
  brand               text        NOT NULL,
  title               text        NOT NULL,

  -- Money as integer minor units, never a float (services/catalog/src/money.ts).
  list_price_minor    bigint      NOT NULL,
  sale_price_minor    bigint      NULL,
  currency            text        NOT NULL,

  availability        text        NOT NULL,
  condition           text        NOT NULL,
  product_url         text        NOT NULL,
  image_url           text        NOT NULL,
  -- Current tracking wrapper. Refreshed in place; never part of identity.
  tracking_url        text        NULL,

  -- Delivery cost is a VERDICT, not a number that defaults to zero. An absent
  -- shipping row must never read as "free": `shipping_verified = false` with a
  -- null cost is the honest state, and the ranking gate refuses it.
  shipping_verified   boolean     NOT NULL DEFAULT false,
  shipping_cost_minor bigint      NULL,
  shipping_destination text       NULL,
  fees_verified       boolean     NOT NULL DEFAULT false,
  fees_total_minor    bigint      NULL,

  -- Provenance: the provider's stamp for this record and the run that wrote it.
  snapshot_at         timestamptz NOT NULL,
  source_feed         text        NOT NULL,
  first_seen_run      uuid        NOT NULL REFERENCES catalog.import_run (id),
  last_seen_run       uuid        NOT NULL REFERENCES catalog.import_run (id),
  last_seen_at        timestamptz NOT NULL,

  -- Lifecycle. A product absent from a new export is `inactive`, not deleted:
  -- CJ exports drop and restore items between days, and erasing the row would
  -- throw away the price history that is the point of keeping it at all.
  state               text        NOT NULL DEFAULT 'active',
  inactive_since      timestamptz NULL,

  CONSTRAINT merchant_offer_identity UNIQUE (merchant_id, merchant_offer_id),
  CONSTRAINT merchant_offer_state_known
    CHECK (state IN ('active', 'inactive')),
  CONSTRAINT merchant_offer_prices_positive
    CHECK (list_price_minor > 0 AND (sale_price_minor IS NULL OR sale_price_minor > 0)),
  -- A verified shipping cost must carry both a figure and a destination: a
  -- cost without a destination is not a verified cost (docs/11, ADR-0021).
  CONSTRAINT merchant_offer_shipping_complete
    CHECK (
      (shipping_verified = false AND shipping_cost_minor IS NULL AND shipping_destination IS NULL)
      OR (shipping_verified = true AND shipping_cost_minor IS NOT NULL AND shipping_destination IS NOT NULL)
    ),
  CONSTRAINT merchant_offer_fees_complete
    CHECK (
      (fees_verified = false AND fees_total_minor IS NULL)
      OR (fees_verified = true AND fees_total_minor IS NOT NULL)
    )
);

CREATE INDEX merchant_offer_active ON catalog.merchant_offer (merchant_id, state);
CREATE INDEX merchant_offer_last_seen ON catalog.merchant_offer (merchant_id, last_seen_at DESC);

-- ── price history ───────────────────────────────────────────────────────────
-- Append-only, one row per observed CHANGE rather than one per import: 225
-- rows a day of mostly-identical prices is noise, and the question this table
-- answers is "when did this price move", not "what did the feed say today".
--
-- Both prices are recorded because a merchant's own sale/regular pair is the
-- only thing the feed states. It is NOT evidence of a saving — a saving needs
-- a delivered total this feed cannot supply — so nothing here may be rendered
-- as one (docs/11 §2, ADR-0021).
CREATE TABLE catalog.offer_price_history (
  id                  bigserial   PRIMARY KEY,
  offer_id            text        NOT NULL REFERENCES catalog.merchant_offer (id) ON DELETE CASCADE,
  import_run_id       uuid        NOT NULL REFERENCES catalog.import_run (id),
  observed_at         timestamptz NOT NULL,
  list_price_minor    bigint      NOT NULL,
  sale_price_minor    bigint      NULL,
  currency            text        NOT NULL,
  -- What moved: 'initial' for the first observation, else 'list', 'sale' or 'both'.
  change_kind         text        NOT NULL,
  CONSTRAINT offer_price_history_kind_known
    CHECK (change_kind IN ('initial', 'list', 'sale', 'both'))
);

CREATE INDEX offer_price_history_offer ON catalog.offer_price_history (offer_id, observed_at DESC);

-- One price observation per offer per run: a re-import of the same export
-- cannot append a second, identical history row.
CREATE UNIQUE INDEX offer_price_history_once_per_run
  ON catalog.offer_price_history (offer_id, import_run_id);

-- ── quarantine ──────────────────────────────────────────────────────────────
-- Rows the guard refused, kept so a rejection can be investigated instead of
-- being a number in a log. Deliberately NARROW: the merchant's SKU, the row
-- number and the reasons. Never the row itself, never a tracking URL, never a
-- price — a quarantine table is the easiest place for merchant content to
-- leak into a backup nobody is guarding.
CREATE TABLE catalog.quarantined_row (
  id                 bigserial   PRIMARY KEY,
  import_run_id      uuid        NOT NULL REFERENCES catalog.import_run (id) ON DELETE CASCADE,
  merchant_id        text        NOT NULL,
  row_number         integer     NOT NULL,
  merchant_offer_id  text        NULL,
  -- Guard reasons, e.g. {'weak-identity','invalid-price'}.
  reasons            text[]      NOT NULL,
  quarantined_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quarantined_row_run ON catalog.quarantined_row (import_run_id);
CREATE INDEX quarantined_row_merchant ON catalog.quarantined_row (merchant_id, quarantined_at DESC);

-- The file records itself, so applying it by hand with psql leaves the ledger
-- correct too. MigrationRunner inserts the same row ON CONFLICT DO NOTHING,
-- which makes the two paths agree instead of fighting.
INSERT INTO catalog.schema_migration (version) VALUES ('0001_catalog_init')
  ON CONFLICT (version) DO NOTHING;
