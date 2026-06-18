-- Resolve the Supabase advisor "Security Definer View" warning on
-- contribution_rankings (community contribution leaderboard: posts aggregated
-- by nickname over the last 30 days).
--
-- UNLIKE the spot count views (service-role only), this view is read by the
-- PUBLIC /api/rankings/contributions route via the ANON key. anon can already
-- read `posts` directly (verified: anon SELECT posts = 38 rows), so running the
-- view as the invoker instead of the definer returns the SAME rankings — just
-- without bypassing RLS. Keep the anon grant (the public route needs it) — do
-- NOT revoke here.
--
-- Run in the Supabase SQL Editor. (Pure DB change — no code deploy needed.)

alter view contribution_rankings set (security_invoker = on);

notify pgrst, 'reload schema';
