-- stories 검색 성능 인덱스: spot 페이지·피드 탭 양쪽에서 매번 도는
-- "WHERE spot_id = X ORDER BY posted_at DESC LIMIT N" 쿼리를 색인 한 번
-- 룩업으로 끝내준다.
--
-- 인덱스 없으면 spot_id 매칭 row 전부 스캔 + posted_at 메모리 정렬이라
-- 가게당 0.5~6초 걸리고, 피드 탭은 가게 10+곳 동시 호출이라 누적된다.
-- spot_views / spot_visits 테이블엔 똑같은 (spot_id, created_at DESC)
-- 패턴 인덱스가 이미 있어서 빠른데, stories만 빠뜨렸던 것.
--
-- 운영 중 테이블이라 CONCURRENTLY로 — 인덱스 빌드 동안 쓰기 락 안 잡음.
-- Supabase SQL Editor에서 각 문장이 자동 트랜잭션 외부 실행이라 동작함.
CREATE INDEX CONCURRENTLY IF NOT EXISTS stories_spot_id_posted_at_idx
  ON stories(spot_id, posted_at DESC);
