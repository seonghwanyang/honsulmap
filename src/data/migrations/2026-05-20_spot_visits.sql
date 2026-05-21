-- Per-visit event log for the "다녀왔어요" tap on a spot. Every tap
-- inserts one row — no dedup, even by the same user. Mirrors
-- 2026-05-19_spot_views.sql but represents a stronger signal than a
-- passive panel open.
--
-- fingerprint is nullable so anonymous visitors can still count.
--
-- Ranking queries:
--   -- All-time top
--   SELECT spot_id, COUNT(*) AS visits
--   FROM spot_visits
--   GROUP BY spot_id
--   ORDER BY visits DESC
--   LIMIT 30;
--
--   -- Last 7 days
--   SELECT spot_id, COUNT(*) AS visits_7d
--   FROM spot_visits
--   WHERE created_at > NOW() - INTERVAL '7 days'
--   GROUP BY spot_id
--   ORDER BY visits_7d DESC
--   LIMIT 30;

CREATE TABLE IF NOT EXISTS spot_visits (
  id BIGSERIAL PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spot_visits_spot_id_created_at_idx
  ON spot_visits(spot_id, created_at DESC);

-- Anyone can record a visit via the API route (uses service role).
-- Direct client access via anon key is denied by default with RLS on.
ALTER TABLE spot_visits ENABLE ROW LEVEL SECURITY;
