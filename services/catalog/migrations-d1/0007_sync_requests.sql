-- =============================================================================
-- MANUAL SYNCHRONISATION, AS A REQUEST RATHER THAN AN IMPORT.
--
-- WHY THE DASHBOARD DOES NOT JUST RUN IT. Retrieving several merchant feeds,
-- reconciling them and publishing takes far longer than an administrative HTTP
-- request should be held open — the measured staging cycle took 36 seconds
-- against two small fixture feeds, and a real catalogue is larger. A request
-- that times out is indistinguishable, from the operator's side, from one that
-- failed, and "I pressed it twice because nothing happened" is how an import
-- gets run concurrently with itself.
--
-- So pressing the button writes a row. The scheduled handler drains it. The
-- row is also what makes "I asked for a sync" visible in the meantime, which a
-- fire-and-forget call would not be.
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalog_sync_request (
  id            TEXT PRIMARY KEY,
  requested_at  TEXT NOT NULL,
  requested_by  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('queued','claimed','done','failed')),
  claimed_at    TEXT,
  finished_at   TEXT,
  -- The cycle that served this request, once one has.
  cycle_id      TEXT,
  detail        TEXT,

  CHECK (status = 'queued' OR claimed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS sync_request_queued
  ON catalog_sync_request (requested_at) WHERE status = 'queued';
