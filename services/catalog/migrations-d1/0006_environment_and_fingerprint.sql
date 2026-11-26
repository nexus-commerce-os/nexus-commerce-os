-- =============================================================================
-- TWO GUARDS THAT THE DATABASE ITSELF ENFORCES.
--
-- Both exist because the alternative was "the caller remembers", and the
-- caller is a cron.
-- =============================================================================

-- ------------------------------------------------------- which environment

-- WHAT THIS PREVENTS. Nothing stopped a fixture source being inserted into
-- production. The `fixture` TRANSPORT is refused there already — it reads a
-- local file — but a fixture served over https is an ordinary https source,
-- and copying that row into prod would have published invented products on
-- honesttotal.com.
--
-- Putting the environment in the DATABASE rather than in a deploy variable is
-- the point: it travels with the data. A row copied into the production
-- database lands next to a column that says `production`, and the guard reads
-- that rather than trusting whatever started the process.
ALTER TABLE catalog_automation_config
  ADD COLUMN environment TEXT NOT NULL DEFAULT 'development'
    CHECK (environment IN ('development','staging','production'));

-- ---------------------------------------------------- the catalogue fingerprint

-- WHAT THIS PREVENTS. A cycle that changes nothing still cost ~300 row writes,
-- every one of them staging publication candidates that were identical to the
-- last set. Measured over twelve consecutive scheduled cycles on staging: the
-- feed was unchanged each time (nine imports, all skipped_duplicate), and the
-- catalogue was republished twelve times anyway.
--
-- The fingerprint is computed AFTER the full eligibility pipeline has run, so
-- freshness expiry, merchant approval, source permissions and the rules
-- version are all inputs to it. Skipping on unchanged FEED BYTES would be the
-- dangerous version of this: an offer expires without the feed changing, and a
-- merchant's approval can be withdrawn without any feed moving at all.
ALTER TABLE catalog_publication_generation ADD COLUMN catalogue_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS publication_generation_fingerprint
  ON catalog_publication_generation (catalogue_fingerprint)
  WHERE catalogue_fingerprint IS NOT NULL;
