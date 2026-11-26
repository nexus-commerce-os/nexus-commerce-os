-- =============================================================================
-- THE DAILY WRITE BUDGET, and what each cycle actually cost.
--
-- D1's free tier allows 100,000 rows written per day and the allowance resets
-- at UTC MIDNIGHT, so the day is the key. Exceeding it does not degrade
-- gracefully: writes start failing, and an import stops half-way. That is
-- recoverable — publication is a separate pointer move, so the catalogue is
-- left staged rather than broken — but it is a bad way to learn what a feed
-- costs.
--
-- ESTIMATED AND AUTHORITATIVE ARE SEPARATE COLUMNS ON PURPOSE. The estimate is
-- what this process counted from `meta.rows_written`: exact for its own work,
-- blind to a migration or an operator with a database client. The
-- authoritative figure is Cloudflare's, and it LAGS, because analytics are
-- aggregated. Storing them in one column would mean a number nobody could
-- interpret, and budgeting against the lagging one would spend the same
-- allowance twice.
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalog_quota_usage (
  -- `YYYY-MM-DD`, UTC. Not a timestamp: the quota is a day, not an instant.
  day                   TEXT PRIMARY KEY,
  estimated_writes      INTEGER NOT NULL DEFAULT 0,
  estimated_reads       INTEGER NOT NULL DEFAULT 0,
  -- NULL until somebody has asked Cloudflare. NULL is "not known", which is
  -- not the same as zero and must never be read as it.
  authoritative_writes  INTEGER,
  authoritative_at      TEXT,
  cycles                INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL,

  CHECK (estimated_writes >= 0),
  CHECK (estimated_reads >= 0),
  CHECK (authoritative_writes IS NULL OR authoritative_writes >= 0),
  -- A figure without a time is a figure nobody can age out.
  CHECK ((authoritative_writes IS NULL) = (authoritative_at IS NULL))
);

CREATE INDEX IF NOT EXISTS quota_usage_recent ON catalog_quota_usage (day DESC);

-- ------------------------------------------------------------- cycle log

-- One row per scheduled cycle. The question this answers is the one an
-- operator asks first and a log file answers worst: "did it run, and what did
-- it do?" A cycle that was REFUSED is recorded too — a scheduler that only
-- writes a row when it succeeds looks identical, in the record, to one that
-- never fired.
CREATE TABLE IF NOT EXISTS catalog_sync_cycle (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  -- 'scheduled' for the cron, 'manual' for an operator, 'test' otherwise. So
  -- "it only ever ran when somebody pressed it" is answerable.
  trigger         TEXT NOT NULL CHECK (trigger IN ('scheduled','manual','test')),
  outcome         TEXT NOT NULL
                    CHECK (outcome IN ('ran','paused','budget_exhausted','failed')),
  sources_considered INTEGER NOT NULL DEFAULT 0,
  sources_imported   INTEGER NOT NULL DEFAULT 0,
  sources_unchanged  INTEGER NOT NULL DEFAULT 0,
  sources_failed     INTEGER NOT NULL DEFAULT 0,
  rows_written    INTEGER NOT NULL DEFAULT 0,
  rows_read       INTEGER NOT NULL DEFAULT 0,
  -- The generation this cycle published, when it published one.
  generation      INTEGER,
  detail          TEXT
);

CREATE INDEX IF NOT EXISTS sync_cycle_recent ON catalog_sync_cycle (started_at DESC);
CREATE INDEX IF NOT EXISTS sync_cycle_outcome ON catalog_sync_cycle (outcome, started_at DESC);

-- ------------------------------------------------------------ source health

-- Consecutive failures per source, so a feed that has been broken for a week
-- is distinguishable from one that failed once. Kept on the source row rather
-- than derived from the cycle log, because the question is asked on every
-- dashboard load and the log grows forever.
ALTER TABLE catalog_feed_source ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE catalog_feed_source ADD COLUMN last_failure_at TEXT;
ALTER TABLE catalog_feed_source ADD COLUMN last_failure_reason TEXT;
