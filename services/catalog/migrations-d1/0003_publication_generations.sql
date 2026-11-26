-- =============================================================================
-- GENERATION-BASED PUBLICATION.
--
-- THE PROBLEM THIS SOLVES. `applyRun` is not atomic on D1 — there is no
-- transaction spanning batches, and an interrupted import measurably leaves
-- its committed writes behind (docs/engineering/d1-database.md). That is only
-- safe because nothing public reads the import tables. Something has to make
-- the catalogue visible, and that something must be atomic, or a half-finished
-- import becomes a half-finished website.
--
-- WHY INTERVALS AND NOT COPIES. The obvious design is one table per
-- generation, or a generation column on every row, and both mean rewriting the
-- whole published catalogue on every synchronisation. At ~11 rows_written per
-- product and 100,000 writes a day, copying a 20,000-product catalogue twice a
-- day would consume the entire budget to say nothing had changed.
--
-- So a published row carries the INTERVAL of generations it is valid for:
--
--   first_generation         the generation that published it
--   last_generation = NULL   still published
--   last_generation = N      published through N, gone from N+1
--
-- Publishing generation N therefore costs one write per CHANGE and nothing at
-- all for a product that did not change. An unchanged catalogue costs the
-- pointer move alone.
--
-- WHAT MAKES IT ATOMIC. The pointer is a single row. Moving it is one UPDATE,
-- guarded by the generation it expects to be replacing, so two publishers
-- cannot both believe they won. Readers resolve the pointer and then filter by
-- interval; they never see a generation that is still being built.
--
-- WHAT MAKES ROLLBACK WORK. Nothing is deleted when a generation supersedes
-- another. Rows closed at N-1 are still inside the interval when the pointer
-- reads N-1, so moving the pointer back restores exactly the catalogue that
-- was live — without reconstructing it.
-- =============================================================================

-- --------------------------------------------------------- the generations

CREATE TABLE IF NOT EXISTS catalog_publication_generation (
  generation    INTEGER PRIMARY KEY,
  status        TEXT NOT NULL
                  CHECK (status IN ('building','live','superseded','abandoned','rolled_back')),
  started_at    TEXT NOT NULL,
  completed_at  TEXT,
  -- Which import produced it. A published catalogue that cannot name its
  -- source is not auditable.
  source_run_id TEXT,
  -- Counted at publication, so a later cliff guard has something to compare
  -- against without scanning the interval table.
  product_count INTEGER,
  -- 'automatic' unless an operator published or rolled back by hand.
  decided_by    TEXT NOT NULL DEFAULT 'automatic',
  detail        TEXT,

  -- A generation that finished must say when; one still building must not.
  CHECK ((status = 'building') = (completed_at IS NULL))
);

-- AT MOST ONE GENERATION MAY BE UNDER CONSTRUCTION, enforced by the database
-- rather than by a lock an interrupted process could keep forever. Two
-- concurrent publication runs cannot both start.
CREATE UNIQUE INDEX IF NOT EXISTS publication_one_building
  ON catalog_publication_generation (status) WHERE status = 'building';

CREATE INDEX IF NOT EXISTS publication_generation_recent
  ON catalog_publication_generation (started_at DESC);

-- ------------------------------------------------------------- the pointer

-- ONE ROW. This is the only thing a public read has to trust, and the only
-- thing publication has to change atomically.
CREATE TABLE IF NOT EXISTS catalog_publication_pointer (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  -- NULL before anything has ever been published, which is NOT the same as
  -- zero: it means the public catalogue is legitimately empty.
  live_generation INTEGER REFERENCES catalog_publication_generation(generation),
  updated_at      TEXT NOT NULL,
  updated_by      TEXT NOT NULL DEFAULT 'automatic'
);

INSERT OR IGNORE INTO catalog_publication_pointer (id, live_generation, updated_at)
VALUES (1, NULL, '1970-01-01T00:00:00.000Z');

-- ------------------------------------------------- the published catalogue

-- Replaced rather than migrated: `catalog_published_product` was keyed on
-- product_id alone, which cannot hold two generations of the same product, and
-- all three databases measurably held zero published rows when this ran
-- (dev/staging/prod checked 26 Nov 2026). Preserving nothing is honest here;
-- pretending to migrate data that does not exist would not be.
DROP TABLE IF EXISTS catalog_published_product;

CREATE TABLE IF NOT EXISTS catalog_published_product (
  product_id       TEXT NOT NULL REFERENCES catalog_product(id),
  first_generation INTEGER NOT NULL REFERENCES catalog_publication_generation(generation),
  -- NULL means still published. A number means published THROUGH that
  -- generation, so rollback finds it again.
  last_generation  INTEGER REFERENCES catalog_publication_generation(generation),

  published_at     TEXT NOT NULL,
  -- Denormalised for the list page: a catalogue listing must not need a join
  -- per row, because D1 bills rows read.
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  brand            TEXT,
  category_slug    TEXT,
  -- Shown to the visitor, so it has to be queryable rather than derived.
  data_verified_at TEXT NOT NULL,
  search_text      TEXT NOT NULL,
  -- The cheapest honest "from" price for a list page. NULL where no offer
  -- carries a comparable price — never zero, which ranking would believe.
  from_price_minor INTEGER,
  from_currency    TEXT,
  offer_count      INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (product_id, first_generation),
  -- An interval cannot end before it begins.
  CHECK (last_generation IS NULL OR last_generation >= first_generation),
  CHECK (from_price_minor IS NULL OR from_currency IS NOT NULL),
  CHECK (offer_count >= 0)
);

-- ONE OPEN ROW PER PRODUCT, and one per slug. Closed rows are history and may
-- repeat freely; what must never happen is two live rows claiming the same
-- product or the same URL. Partial indexes make that an invariant rather than
-- a convention.
CREATE UNIQUE INDEX IF NOT EXISTS published_product_open
  ON catalog_published_product (product_id) WHERE last_generation IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS published_slug_open
  ON catalog_published_product (slug) WHERE last_generation IS NULL;

-- The read path. Every public query resolves the pointer and then filters on
-- the interval, so these lead with the interval columns.
CREATE INDEX IF NOT EXISTS published_interval
  ON catalog_published_product (first_generation, last_generation);
CREATE INDEX IF NOT EXISTS published_slug_lookup
  ON catalog_published_product (slug, first_generation);
CREATE INDEX IF NOT EXISTS published_category_listing
  ON catalog_published_product (category_slug, title, first_generation);
CREATE INDEX IF NOT EXISTS published_brand_listing
  ON catalog_published_product (brand, title, first_generation);
CREATE INDEX IF NOT EXISTS published_freshness
  ON catalog_published_product (data_verified_at DESC, first_generation);

-- -------------------------------------------------- what a generation staged

-- The staging area for a generation under construction. A row here is a
-- CANDIDATE: it has been computed but is not visible to anyone, so a
-- generation can be built incrementally across several Worker invocations and
-- still be published in one atomic move.
--
-- This is deliberately not the same table as the published intervals. Writing
-- candidates straight into the published table and relying on the pointer to
-- hide them would mean one bad filter in one query exposes unpublished rows.
CREATE TABLE IF NOT EXISTS catalog_publication_candidate (
  generation       INTEGER NOT NULL REFERENCES catalog_publication_generation(generation),
  product_id       TEXT NOT NULL REFERENCES catalog_product(id),
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  brand            TEXT,
  category_slug    TEXT,
  data_verified_at TEXT NOT NULL,
  search_text      TEXT NOT NULL,
  from_price_minor INTEGER,
  from_currency    TEXT,
  offer_count      INTEGER NOT NULL DEFAULT 0,
  -- 1 = should be public in this generation, 0 = deliberately withheld. A
  -- withheld candidate carries its reason, so the dashboard can explain an
  -- absence without re-running the rules.
  eligible         INTEGER NOT NULL CHECK (eligible IN (0,1)),
  reason_code      TEXT NOT NULL,

  PRIMARY KEY (generation, product_id),
  CHECK (from_price_minor IS NULL OR from_currency IS NOT NULL),
  CHECK (offer_count >= 0)
);

CREATE INDEX IF NOT EXISTS publication_candidate_eligible
  ON catalog_publication_candidate (generation, eligible);
CREATE UNIQUE INDEX IF NOT EXISTS publication_candidate_slug
  ON catalog_publication_candidate (generation, slug);
