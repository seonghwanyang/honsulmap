-- QR 체크인 방문 기록 정상화 + 다녀왔어요 카운트에 합산.
--
-- 배경: 2026-08-31_data_capture.sql의 spot_visits(새 스키마)는 2026-05-20의
-- 동명 구테이블(fingerprint 스키마)이 이미 있어 IF NOT EXISTS로 스킵됐고,
-- 체크인 방문 insert(guest_key 컬럼)는 그 뒤로 전부 조용히 실패해 왔다.
-- → 체크인 방문은 새 이름(spot_checkin_visits)으로 분리 생성하고,
--   spot_visit_counts 뷰를 "다녀왔어요 버튼 + 체크인" 합산으로 재정의한다.
-- Run in the Supabase SQL Editor.

-- ① 체크인 방문 — 가게×기기해시×영업일 1행 (단골 지표·계정 소급 연결용)
create table if not exists spot_checkin_visits (
  id                 uuid primary key default gen_random_uuid(),
  spot_id            uuid not null references spots(id) on delete cascade,
  guest_key          text not null,           -- phone4_hash (기기+가게 해시, 가게 간 추적 불가)
  business_day_start timestamptz not null,    -- 영업일 경계(KST 08:00)
  user_id            uuid references auth.users(id) on delete set null,
  checkins           int not null default 1,
  first_checkin_at   timestamptz not null default now(),
  unique (spot_id, guest_key, business_day_start)
);
create index if not exists idx_scv_spot_guest on spot_checkin_visits (spot_id, guest_key);
alter table spot_checkin_visits enable row level security; -- 서비스롤 API 전용

-- ② 다녀왔어요 카운트 = 지도 버튼 방문 + QR 체크인 방문 합산
create or replace view spot_visit_counts as
  select spot_id, count(*)::bigint as visits
  from (
    select spot_id from spot_visits
    union all
    select spot_id from spot_checkin_visits
  ) t
  group by spot_id;

-- 뷰 재생성 시 보안 속성·권한 재적용 (2026-06-17과 동일 정책)
alter view spot_visit_counts set (security_invoker = on);
revoke select on spot_visit_counts from anon, authenticated;
grant select on spot_visit_counts to service_role;

NOTIFY pgrst, 'reload schema';
