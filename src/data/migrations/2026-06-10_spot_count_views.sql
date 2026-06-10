-- Pre-aggregated per-spot count views for the admin spots dashboard.
--
-- The /admin/spots route used to fetch every spot_views / spot_visits row
-- and tally them in JS. PostgREST caps result sets at the project "Max Rows"
-- (default 1000), so once either event log passed ~1000 total rows only the
-- first 1000 came back and the 조회수 / 다녀왔어요 counts froze. Aggregate
-- functions are disabled on this project (PGRST123), so we pre-aggregate in
-- the database instead and let the route read one row per spot.
--
-- Each view returns at most one row per spot (a few hundred spots, well under
-- the 1000 cap), so selecting the whole view is never truncated.
--
-- These are plain views owned by postgres — NOT security_invoker — so they
-- read past the RLS on spot_views / spot_visits and see every row.

CREATE OR REPLACE VIEW spot_view_counts AS
  SELECT spot_id, COUNT(*) AS views
  FROM spot_views
  GROUP BY spot_id;

CREATE OR REPLACE VIEW spot_visit_counts AS
  SELECT spot_id, COUNT(*) AS visits
  FROM spot_visits
  GROUP BY spot_id;

GRANT SELECT ON spot_view_counts, spot_visit_counts TO service_role, anon, authenticated;
