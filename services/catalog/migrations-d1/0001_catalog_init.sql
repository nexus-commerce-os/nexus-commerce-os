-- =============================================================================
-- D1 (SQLite) schema for the commerce catalogue.
--
-- MIRRORS THE POSTGRES SCHEMA, IT DOES NOT REPLACE IT. The Postgres adapter
-- stays; the storage interface is what both implement, and a shared contract
-- suite runs against each. Portability is the point: D1's free tier is a
-- starting line (500 MB per database, 5 GB per account, 5M rows read and
-- 100k rows written per day), not a destination.
--
-- WHAT SQLITE CHANGES, AND WHY EACH CHOICE IS MADE
--
-- 1. MONEY IS INTEGER, NEVER REAL. SQLite's INTEGER is 64-bit, which holds
--    minor units exactly. REAL is IEEE-754 and would make 19.99 unstorable.
--    The adapter reads these back through a guard, because a JS number loses
--    precision above 2^53 and a silently wrong price is worse than an error.
--
-- 2. NO NATIVE TIMESTAMP OR UUID. Both are TEXT: ISO-8601 in UTC, and the
--    UUID as its canonical string. Stored sortable, so range scans on time
--    work with an ordinary index.
--
-- 3. NO NATIVE BOOLEAN. INTEGER 0/1, with CHECK constraints so a third value
--    cannot appear.
--
-- 4. NO SCHEMAS. Postgres puts these in `catalog.`; SQLite has one namespace,
--    so the prefix becomes part of the table name. Keeping the same words in
--    the same order makes the two schemas diffable by eye.
--
-- 5. PARTIAL UNIQUE INDEXES EXIST in SQLite, which matters: the
--    once-per-run and applied-once guarantees are enforced by the database in
--    both engines rather than by application code in one of them.
--
-- FOREIGN KEYS ARE ON BY DEFAULT IN D1 and cannot be disabled per query.
-- Insert order therefore matters, and the adapter writes parents first.
-- =============================================================================

-- Every attempt to ingest a feed, successful or not.
-- "We looked and declined" and "we never ran" are different facts.
CREATE TABLE IF NOT EXISTS catalog_import_run (
  id                TEXT PRIMARY KEY,
  merchant_id       TEXT NOT NULL,
  source_feed       TEXT NOT NULL,
  content_sha256    TEXT NOT NULL,
  feed_exported_at  TEXT,
  started_at        TEXT NOT NULL,
  finished_at       TEXT,
  status            TEXT NOT NULL
                      CHECK (status IN ('started','applied','skipped_duplicate','skipped_stale','failed')),
  rows_total        INTEGER,
  offers_added      INTEGER,
  offers_removed    INTEGER,
  offers_updated    INTEGER,
  offers_unchanged  INTEGER,
  rows_quarantined  INTEGER,
  skip_reason       TEXT
);

-- THE IDEMPOTENCY GUARANTEE. One applied run per (merchant, payload). This is
-- what makes two simultaneous imports of one export safe: the loser fails on
-- this index and takes its half-written catalogue down with it.
CREATE UNIQUE INDEX IF NOT EXISTS import_run_applied_once
  ON catalog_import_run (merchant_id, content_sha256)
  WHERE status = 'applied';

CREATE INDEX IF NOT EXISTS import_run_recent
  ON catalog_import_run (merchant_id, started_at DESC);

-- A JOB LEASE IS A QUERY, NOT A TABLE. A `started` run is a run someone is
-- performing; this index makes "is this source already being imported" cheap.
CREATE INDEX IF NOT EXISTS import_run_in_flight
  ON catalog_import_run (merchant_id, source_feed, status, started_at DESC);

CREATE TABLE IF NOT EXISTS catalog_merchant_offer (
  id                   TEXT PRIMARY KEY,
  merchant_id          TEXT NOT NULL,
  merchant_offer_id    TEXT NOT NULL,
  gtin                 TEXT,
  mpn                  TEXT,
  brand                TEXT,
  title                TEXT NOT NULL,
  -- Minor units. See note 1: never REAL.
  list_price_minor     INTEGER,
  sale_price_minor     INTEGER,
  currency             TEXT,
  availability         TEXT,
  condition            TEXT,
  product_url          TEXT,
  image_url            TEXT,
  tracking_url         TEXT,
  shipping_verified    INTEGER NOT NULL DEFAULT 0 CHECK (shipping_verified IN (0,1)),
  shipping_cost_minor  INTEGER,
  shipping_destination TEXT,
  fees_verified        INTEGER NOT NULL DEFAULT 0 CHECK (fees_verified IN (0,1)),
  fees_total_minor     INTEGER,
  snapshot_at          TEXT NOT NULL,
  source_feed          TEXT NOT NULL,
  first_seen_run       TEXT NOT NULL REFERENCES catalog_import_run(id),
  last_seen_run        TEXT NOT NULL REFERENCES catalog_import_run(id),
  last_seen_at         TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','inactive')),
  inactive_since       TEXT,

  -- A HALF-FILLED COST IS IMPOSSIBLE TO RECORD, not merely discouraged. A
  -- verified shipping cost without a destination is not a fact, and an
  -- unverified one must not carry a number that ranking could mistake for
  -- zero. Same reasoning for fees.
  CHECK (shipping_verified = 0 OR (shipping_cost_minor IS NOT NULL AND shipping_destination IS NOT NULL)),
  CHECK (shipping_verified = 1 OR shipping_cost_minor IS NULL),
  CHECK (fees_verified = 0 OR fees_total_minor IS NOT NULL),
  CHECK (fees_verified = 1 OR fees_total_minor IS NULL),
  -- Inactive means a date; active means none. Neither state can lie.
  CHECK ((state = 'inactive') = (inactive_since IS NOT NULL))
);

-- IDENTITY IS (merchant, merchant_offer_id) AND NOTHING ELSE. LINK,
-- IMPRESSION_URL and LAST_UPDATED churn daily — 147 of 183 changes between two
-- real exports were the affiliate wrapper rotating — so keying on any of them
-- would retire and recreate most of the catalogue every morning.
CREATE UNIQUE INDEX IF NOT EXISTS merchant_offer_identity
  ON catalog_merchant_offer (merchant_id, merchant_offer_id);

CREATE INDEX IF NOT EXISTS merchant_offer_active
  ON catalog_merchant_offer (merchant_id, state);
CREATE INDEX IF NOT EXISTS merchant_offer_last_seen
  ON catalog_merchant_offer (merchant_id, last_seen_at DESC);
-- Cross-merchant matching reads these. Partial, so the index holds only rows
-- that can actually match rather than every NULL.
CREATE INDEX IF NOT EXISTS merchant_offer_gtin ON catalog_merchant_offer (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS merchant_offer_mpn  ON catalog_merchant_offer (brand, mpn) WHERE mpn IS NOT NULL;

-- Price history records MOVEMENT, not sightings: a row exists because a price
-- changed, not because a feed was read.
CREATE TABLE IF NOT EXISTS catalog_offer_price_history (
  id                TEXT PRIMARY KEY,
  offer_id          TEXT NOT NULL REFERENCES catalog_merchant_offer(id),
  import_run_id     TEXT NOT NULL REFERENCES catalog_import_run(id),
  observed_at       TEXT NOT NULL,
  list_price_minor  INTEGER,
  sale_price_minor  INTEGER,
  currency          TEXT,
  availability      TEXT
);

CREATE INDEX IF NOT EXISTS offer_price_history_offer
  ON catalog_offer_price_history (offer_id, observed_at DESC);
-- One history row per offer per run, enforced by the database in BOTH
-- engines. The in-memory double once did this with a linear scan and turned a
-- 100k import into 149 seconds.
CREATE UNIQUE INDEX IF NOT EXISTS offer_price_history_once_per_run
  ON catalog_offer_price_history (offer_id, import_run_id);

-- A row that could not be trusted, kept with the reason.
-- Quarantine is not deletion: an ambiguous record is a question, not rubbish.
CREATE TABLE IF NOT EXISTS catalog_quarantined_row (
  id             TEXT PRIMARY KEY,
  import_run_id  TEXT NOT NULL REFERENCES catalog_import_run(id),
  merchant_id    TEXT NOT NULL,
  row_ref        TEXT,
  reason         TEXT NOT NULL,
  detail         TEXT,
  quarantined_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS quarantined_row_run      ON catalog_quarantined_row (import_run_id);
CREATE INDEX IF NOT EXISTS quarantined_row_merchant ON catalog_quarantined_row (merchant_id, quarantined_at DESC);
