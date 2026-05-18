-- Per-view event log for spot panel opens. Every panel open (map sheet
-- or /spot/[slug] page) inserts one row. No dedup — same user reloading
-- counts as new views, matching how YouTube / Naver "조회수" works.
--
-- Storage: ~50 bytes/row. At 1000 users × 5 views × 30d the table is
-- ~7.5 MB/month — negligible vs Supabase's 500 MB free tier.
--
-- Ranking queries:
--   -- All-time top
--   SELECT spot_id, COUNT(*) AS views
--   FROM spot_views
--   GROUP BY spot_id
--   ORDER BY views DESC
--   LIMIT 30;
--
--   -- Last 7 days
--   SELECT spot_id, COUNT(*) AS views_7d
--   FROM spot_views
--   WHERE created_at > NOW() - INTERVAL '7 days'
--   GROUP BY spot_id
--   ORDER BY views_7d DESC
--   LIMIT 30;

CREATE TABLE IF NOT EXISTS spot_views (
  id BIGSERIAL PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Covers both "top of all time" (GROUP BY spot_id) and "last N days"
-- (WHERE created_at > X AND spot_id = Y) lookups.
CREATE INDEX IF NOT EXISTS spot_views_spot_id_created_at_idx
  ON spot_views(spot_id, created_at DESC);

-- Anyone (anonymous visitors included) can record a view via the API
-- route — which uses the service role key, so RLS only needs to lock
-- direct client access. Reads are allowed for the rankings endpoint
-- (also service-role) but not for arbitrary public selects.
ALTER TABLE spot_views ENABLE ROW LEVEL SECURITY;
