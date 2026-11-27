-- =============================================================================
-- Publication decisions, feed configuration, and the administration surface.
--
-- WHY THESE ARE TABLES AND NOT CODE. Every one of them answers a question an
-- operator will eventually ask about something that already happened: why is
-- this product public, when did that feed last run, who paused automation,
-- who changed a role. A decision that exists only as the current state of a
-- boolean cannot answer any of those.
-- =============================================================================

-- ------------------------------------------------------------------ products

-- A product is the thing a visitor compares. An OFFER is one merchant selling
-- it. Keeping them apart is what makes multi-merchant comparison possible
-- later without rewriting the catalogue.
CREATE TABLE IF NOT EXISTS catalog_product (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  brand            TEXT,
  brand_normalised TEXT,
  category_slug    TEXT,
  gtin             TEXT,
  mpn              TEXT,
  -- Variants of one product share this. Each keeps its own GTIN.
  variant_group_id TEXT,
  summary          TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_slug ON catalog_product (slug);
CREATE INDEX IF NOT EXISTS product_category ON catalog_product (category_slug);
CREATE INDEX IF NOT EXISTS product_brand ON catalog_product (brand_normalised);
CREATE INDEX IF NOT EXISTS product_gtin ON catalog_product (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_variant_group
  ON catalog_product (variant_group_id) WHERE variant_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_category (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_slug TEXT REFERENCES catalog_category(slug)
);

CREATE TABLE IF NOT EXISTS catalog_brand (
  normalised TEXT PRIMARY KEY,
  display    TEXT NOT NULL
);

-- Label/value pairs, kept verbatim in the manufacturer's own units and wording.
CREATE TABLE IF NOT EXISTS catalog_specification (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES catalog_product(id),
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  -- The normalised form, where one could be derived. NULL is a finding, not a
  -- gap to be filled with a guess.
  unit        TEXT,
  value_num   REAL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS specification_product ON catalog_specification (product_id, position);

-- Which offers belong to which product, and how confidently.
-- AMBIGUOUS MATCHES ARE NOT MERGED. A low-confidence link is quarantined, because
-- merging two different products is worse than listing one twice.
CREATE TABLE IF NOT EXISTS catalog_product_offer (
  product_id  TEXT NOT NULL REFERENCES catalog_product(id),
  offer_id    TEXT NOT NULL REFERENCES catalog_merchant_offer(id),
  match_basis TEXT NOT NULL CHECK (match_basis IN ('gtin','brand_mpn','manual')),
  confidence  TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  matched_at  TEXT NOT NULL,
  PRIMARY KEY (product_id, offer_id)
);

CREATE INDEX IF NOT EXISTS product_offer_by_offer ON catalog_product_offer (offer_id);

-- --------------------------------------------------------------- merchants

CREATE TABLE IF NOT EXISTS catalog_merchant (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  network       TEXT,
  advertiser_id TEXT,
  -- `pending` until a live check says otherwise. Possession of a feed is not
  -- approval, and an old note is not a verification.
  relationship  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (relationship IN ('pending','approved','declined','suspended')),
  destination_url TEXT,
  -- NULL unless the relationship is approved. The CHECK makes an affiliate
  -- link impossible to store for an unapproved merchant, so the rule cannot be
  -- forgotten at a call site.
  affiliate_url TEXT,
  verified_at   TEXT,
  CHECK (affiliate_url IS NULL OR relationship = 'approved')
);

-- What a source's terms actually permit. Unread is NOT permissive.
CREATE TABLE IF NOT EXISTS catalog_source_permission (
  id          TEXT PRIMARY KEY,
  domain      TEXT NOT NULL,
  verdict     TEXT NOT NULL CHECK (verdict IN ('eligible','quarantined','unread')),
  terms_url   TEXT,
  reason      TEXT NOT NULL,
  audited_on  TEXT NOT NULL,
  -- Reproducing a maker's photograph is a separate permission from quoting a
  -- specification, and conflating them is how an image lawsuit starts.
  images_permitted INTEGER NOT NULL DEFAULT 0 CHECK (images_permitted IN (0,1))
);

CREATE UNIQUE INDEX IF NOT EXISTS source_permission_domain ON catalog_source_permission (domain);

-- ------------------------------------------------------------- feed config

CREATE TABLE IF NOT EXISTS catalog_feed_source (
  id                TEXT PRIMARY KEY,
  merchant_id       TEXT NOT NULL REFERENCES catalog_merchant(id),
  transport         TEXT NOT NULL CHECK (transport IN ('https','api','ftp','sftp','fixture')),
  url               TEXT NOT NULL,
  format            TEXT NOT NULL CHECK (format IN ('csv','tsv','xml','json')),
  every_minutes     INTEGER NOT NULL CHECK (every_minutes >= 1),
  min_interval_minutes INTEGER,
  -- The NAME of a secret, never the secret. A config row is copied into
  -- tickets, backups and dashboards; a secret in one has leaked.
  credential_ref    TEXT,
  auth_kind         TEXT CHECK (auth_kind IN ('none','bearer','basic','query')),
  auth_detail       TEXT,
  enabled           INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  -- Per-source pause, separate from `enabled`: pausing is an operator action
  -- with a reason and a timestamp, disabling is configuration.
  paused            INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
  paused_reason     TEXT,
  paused_at         TEXT,
  last_success_at   TEXT,
  last_attempt_at   TEXT,
  etag              TEXT,
  last_modified     TEXT,
  payload_sha256    TEXT,
  CHECK (paused = 0 OR paused_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS feed_source_due
  ON catalog_feed_source (enabled, paused, last_success_at);

-- ------------------------------------------------------- publication rules

-- Why a product is or is not public, recorded per decision rather than as a
-- single boolean. An automated publication that cannot be explained afterwards
-- is indistinguishable from a bug.
CREATE TABLE IF NOT EXISTS catalog_publication_decision (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES catalog_product(id),
  decided_at  TEXT NOT NULL,
  published   INTEGER NOT NULL CHECK (published IN (0,1)),
  -- Machine-readable, so the dashboard can group by reason.
  reason_code TEXT NOT NULL,
  detail      TEXT,
  -- 'automatic' unless a human overrode it.
  decided_by  TEXT NOT NULL DEFAULT 'automatic',
  rules_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS publication_decision_product
  ON catalog_publication_decision (product_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS publication_decision_reason
  ON catalog_publication_decision (reason_code, decided_at DESC);

-- The current published set, which is what the public read layer queries.
-- Separate from the decision log so a page load is one indexed lookup rather
-- than a scan of history.
CREATE TABLE IF NOT EXISTS catalog_published_product (
  product_id   TEXT PRIMARY KEY REFERENCES catalog_product(id),
  published_at TEXT NOT NULL,
  -- Denormalised for the list page: a catalogue listing must not need a join
  -- per row, and D1 bills rows read.
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  brand         TEXT,
  category_slug TEXT,
  -- Freshness is shown to the visitor, so it has to be queryable.
  data_verified_at TEXT NOT NULL,
  search_text   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS published_product_slug ON catalog_published_product (slug);
CREATE INDEX IF NOT EXISTS published_product_category ON catalog_published_product (category_slug, title);
CREATE INDEX IF NOT EXISTS published_product_brand ON catalog_published_product (brand, title);
CREATE INDEX IF NOT EXISTS published_product_fresh ON catalog_published_product (data_verified_at DESC);

-- --------------------------------------------------------------- automation

-- One row. A global pause that lives in the database rather than in a deploy,
-- so stopping automation does not require shipping code.
CREATE TABLE IF NOT EXISTS catalog_automation_config (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  paused        INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
  paused_reason TEXT,
  paused_by     TEXT,
  paused_at     TEXT,
  auto_publish  INTEGER NOT NULL DEFAULT 1 CHECK (auto_publish IN (0,1)),
  updated_at    TEXT NOT NULL,
  CHECK (paused = 0 OR paused_reason IS NOT NULL)
);

INSERT OR IGNORE INTO catalog_automation_config (id, paused, auto_publish, updated_at)
VALUES (1, 0, 1, '1970-01-01T00:00:00.000Z');

-- ------------------------------------------------------------------- admin

CREATE TABLE IF NOT EXISTS admin_user (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','operator','viewer')),
  -- pbkdf2$sha256$<iterations>$<salt>$<hash>. Never a plaintext password, and
  -- never a reversible encryption of one.
  password_hash TEXT NOT NULL,
  disabled      INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1)),
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_user_email ON admin_user (lower(email));

-- Append-only. Denials are recorded as well as grants: an authorisation check
-- whose refusals are invisible cannot be reviewed.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         TEXT PRIMARY KEY,
  at         TEXT NOT NULL,
  actor_id   TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  outcome    TEXT NOT NULL CHECK (outcome IN ('allowed','denied','failed')),
  detail     TEXT
);

CREATE INDEX IF NOT EXISTS admin_audit_recent ON admin_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_actor ON admin_audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_outcome ON admin_audit_log (outcome, at DESC);
