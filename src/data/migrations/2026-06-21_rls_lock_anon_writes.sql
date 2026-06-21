-- Lock down anon WRITE access on posts / comments / spots / stories.
--
-- The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) ships to every browser, so any
-- `USING (true)` UPDATE/DELETE policy lets ANYONE bypass the API (the post/
-- comment password gate, admin basic-auth) and hit the PostgREST endpoint
-- directly to wipe or alter rows. That is what was happening here.
--
-- The API now performs every posts/comments UPDATE/DELETE — and all spots/
-- stories writes — with the SERVICE ROLE (which bypasses RLS legitimately after
-- its own authz). So anon needs SELECT only, plus INSERT on posts/comments so
-- anyone can still create a post/comment.
--
-- ⚠️ ORDER MATTERS: run this AFTER the matching code change is deployed.
--    (코드가 service role로 쓰기 시작한 뒤 실행 — 먼저 돌리면 글 수정/삭제·댓글
--     삭제가 잠깐 깨집니다.)

-- posts / comments: keep SELECT + INSERT, drop the destructive UPDATE/DELETE.
drop policy if exists posts_update_anon    on posts;
drop policy if exists posts_delete_anon    on posts;
drop policy if exists comments_update_anon on comments;
drop policy if exists comments_delete_anon on comments;

-- spots: anon is read-only. Every insert/update is admin or partner (service role).
drop policy if exists spots_update_anon on spots;
drop policy if exists spots_insert_anon on spots;

-- stories: written only by the scraper (service role). No anon insert needed.
drop policy if exists stories_insert_anon on stories;

notify pgrst, 'reload schema';
