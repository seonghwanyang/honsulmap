-- Lock down anon access on likes / mood_votes.
--
-- Every likes/mood_votes access in the app goes through an API route using the
-- SERVICE ROLE (the post/comment/spot like routes + the spot mood route). No
-- client/component touches these tables with the anon key, so anon needs no
-- policy at all — RLS-enabled + zero policies = service-role-only.
--
-- Unlike the posts/comments lock (2026-06-21), the code ALREADY uses the
-- service role here, so this can be run ANY TIME (no deploy ordering needed).

drop policy if exists likes_select_anon      on likes;
drop policy if exists likes_insert_anon      on likes;
drop policy if exists likes_delete_anon      on likes;

drop policy if exists mood_votes_select_anon on mood_votes;
drop policy if exists mood_votes_insert_anon on mood_votes;
drop policy if exists mood_votes_update_anon on mood_votes;
drop policy if exists mood_votes_delete_anon on mood_votes;

notify pgrst, 'reload schema';
