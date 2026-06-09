-- Adaptive scrape scheduling.
--
-- Today every IG-linked spot is re-checked on the same uniform cadence, so
-- ~95 dead/quiet spots burn the same throughput as the ~100 active ones.
-- These two columns let the worker back a spot off (up to 24h) after each
-- empty fetch and snap it back to the base interval the moment it posts a
-- story again — concentrating throughput on the spots that actually move.
--
--   consecutive_empty : empty-fetch streak (0 = just had a story)
--   next_scrape_at    : when this spot is next due; the worker only pulls
--                       spots with next_scrape_at <= now()
--
-- Idempotent — safe to re-run.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS consecutive_empty integer NOT NULL DEFAULT 0;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz;

-- Seed existing rows from last_scraped_at so the first adaptive pass keeps
-- the current "least-recently-scraped first" order (NULL → due now).
UPDATE spots SET next_scrape_at = COALESCE(last_scraped_at, now()) WHERE next_scrape_at IS NULL;

-- New rows are due immediately by default; never leave it NULL (a NULL would
-- be skipped by the `next_scrape_at <= now()` filter and never get scraped).
ALTER TABLE spots ALTER COLUMN next_scrape_at SET DEFAULT now();
ALTER TABLE spots ALTER COLUMN next_scrape_at SET NOT NULL;

-- The scheduler query orders by next_scrape_at; index it.
CREATE INDEX IF NOT EXISTS spots_next_scrape_at_idx ON spots (next_scrape_at);
