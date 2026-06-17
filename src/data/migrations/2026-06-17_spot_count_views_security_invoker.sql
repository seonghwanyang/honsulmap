-- Resolve the Supabase advisor "Security Definer View" warning on
-- spot_view_counts / spot_visit_counts.
--
-- 2026-06-10 left these as plain (definer) views on purpose, to read past RLS
-- on spot_views/spot_visits. But ONLY the admin + partner spot routes query
-- them, and both use the service_role key — which bypasses RLS anyway
-- (verified: service_role reads spot_views = 5,633 rows, spot_visits = 89 rows
-- in full). So flipping to security_invoker is advisor-clean with NO change to
-- the counts the dashboards see, and the anon/authenticated grants were never
-- used (the public site never queries these views) → drop them.
--
-- Run in the Supabase SQL Editor. (Pure DB change — no code deploy needed.)

alter view spot_view_counts  set (security_invoker = on);
alter view spot_visit_counts set (security_invoker = on);

revoke select on spot_view_counts, spot_visit_counts from anon, authenticated;

notify pgrst, 'reload schema';
