-- Both spot_views (2026-05-19) and spot_visits (2026-05-20) enabled RLS
-- but defined zero policies. The Next.js API routes use the anon-key
-- supabase client, so without an INSERT policy Postgres silently denies
-- every event log write. This adds the missing policies.
--
-- Rationale: these tables hold public, anonymous engagement counters.
-- No PII. Read + write are both open to anon.

-- spot_views ----------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_spot_views" ON spot_views;
CREATE POLICY "anon_insert_spot_views"
  ON spot_views
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_spot_views" ON spot_views;
CREATE POLICY "anon_select_spot_views"
  ON spot_views
  FOR SELECT
  TO anon
  USING (true);

-- spot_visits ---------------------------------------------------------
DROP POLICY IF EXISTS "anon_insert_spot_visits" ON spot_visits;
CREATE POLICY "anon_insert_spot_visits"
  ON spot_visits
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_spot_visits" ON spot_visits;
CREATE POLICY "anon_select_spot_visits"
  ON spot_visits
  FOR SELECT
  TO anon
  USING (true);
