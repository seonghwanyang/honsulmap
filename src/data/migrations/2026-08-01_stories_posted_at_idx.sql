-- 모아보기(/api/stories/latest) 500 해결 — stories.posted_at 인덱스.
--
-- stories가 67k행을 넘으면서 ORDER BY posted_at DESC 풀 정렬이 3.2초+
-- (실측 2026-08-01) → anon 롤 statement timeout(3s)에 걸려 피드 API가
-- "canceling statement due to statement timeout" 500을 반환했다.
-- 이 인덱스로 최신순 50개 조회가 수 ms로 떨어진다.
--
-- Supabase SQL Editor에서 실행.

CREATE INDEX IF NOT EXISTS stories_posted_at_idx
  ON stories (posted_at DESC);
