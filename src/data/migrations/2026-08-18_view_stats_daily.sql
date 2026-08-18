-- /admin/view-stats 최적화 — KST 일별 사전집계 뷰.
--
-- 기존 라우트는 매 요청마다 spot_views 원본(~1.6만행)과 stories 원본(~4.3만행)을
-- PostgREST 1000행 페이지네이션으로 통째(~60왕복) 긁어와 JS에서 일별 집계했다
-- → 첫 로드 ~26초. 최종 산출물은 "일별 카운트 + 스팟별 스토리수"뿐인데 원본
-- 수만 행을 네트워크로 나른 게 낭비였다.
--
-- 이 뷰들이 (spot_id, KST일자) 단위로 미리 COUNT 해주므로, 라우트는 소량의
-- 집계 행만 읽는다(수만행 → 수천행, ~60왕복 → 한 자릿수). 다운스트림 계산 로직은
-- 동일(일별 카운트는 DB에서 세든 JS에서 세든 같은 값).
--
-- 기존 spot_view_counts 패턴과 동일: 일반 뷰(postgres 소유, NOT security_invoker)라
-- spot_views / stories 의 RLS를 지나 전체 행을 집계한다. PGRST123로 PostgREST의
-- 집계 API는 막혀 있어도, 뷰 내부 COUNT는 정상(뷰가 미리 계산해 두는 것이라).
--
-- Supabase SQL Editor에서 실행.

CREATE OR REPLACE VIEW spot_views_daily AS
  SELECT spot_id,
         (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
         COUNT(*) AS views
  FROM spot_views
  GROUP BY spot_id, (created_at AT TIME ZONE 'Asia/Seoul')::date;

CREATE OR REPLACE VIEW story_counts_daily AS
  SELECT spot_id,
         (posted_at AT TIME ZONE 'Asia/Seoul')::date AS day,
         COUNT(*) AS stories
  FROM stories
  WHERE spot_id IS NOT NULL
  GROUP BY spot_id, (posted_at AT TIME ZONE 'Asia/Seoul')::date;

-- 관리자 라우트는 service_role로만 읽는다 (익명/일반 유저 노출 불필요).
GRANT SELECT ON spot_views_daily, story_counts_daily TO service_role;

notify pgrst, 'reload schema';
