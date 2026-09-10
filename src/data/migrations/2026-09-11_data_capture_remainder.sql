-- 2026-08-31_data_capture.sql의 후반부 재실행.
--
-- 배경: 원본 파일은 ① spot_visits를 IF NOT EXISTS로 만들려다 2026-05-20의 동명 구테이블에 막혀
-- 조용히 스킵됐고, 바로 다음 줄 `create index … on spot_visits (spot_id, guest_key)`가
-- guest_key 컬럼이 없어 에러로 멈췄다. 그 뒤에 있던 ② spot_day_stats ③ menu_events는
-- 실행되지 않은 채 끝났다. ①은 2026-09-07_checkin_visits.sql이 spot_checkin_visits로 해결했고,
-- ②③이 없다는 사실은 09-10 Sentry 크론 경고
--   "Could not find the table 'public.spot_day_stats' in the schema cache"
-- 로 발견됐다. 그동안 마감 스냅샷(크론·마감 버튼)과 메뉴 담기/빼기 기록은 전부 조용히 실패했다.
--
-- Run in the Supabase SQL Editor. 끝의 검증 블록이 실패하면 트랜잭션째 롤백된다 — 조용히 넘어가지 않는다.

begin;

-- ② 마감 스냅샷 — 프로필 익명화 직전에 집계만 보존 (개인 행 없음).
create table if not exists spot_day_stats (
  id                 uuid primary key default gen_random_uuid(),
  spot_id            uuid not null references spots(id) on delete cascade,
  business_day_start timestamptz not null,
  stats              jsonb not null,          -- {sessions, by_gender, by_age, by_purpose, by_vibe, orders_count, orders_total}
  created_at         timestamptz not null default now(),
  unique (spot_id, business_day_start)
);

-- ③ 메뉴 행동 — 담김/뺌 이벤트 (주문은 table_orders가 원장). "봤는데 안 시킴" 분석용.
create table if not exists menu_events (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references spots(id) on delete cascade,
  session_id uuid references table_sessions(id) on delete set null,
  item_id    uuid,
  item_name  text not null,
  action     text not null check (action in ('cart_add', 'cart_remove')),
  created_at timestamptz not null default now()
);
create index if not exists idx_menu_events_spot_created on menu_events (spot_id, created_at desc);

-- 접근은 서비스롤 API 전용 (RLS 정책 없음 = anon/authenticated 차단)
alter table spot_day_stats enable row level security;
alter table menu_events    enable row level security;

-- 검증: 기대한 컬럼으로 실제 존재하는지. IF NOT EXISTS가 다른 모양의 동명 테이블을 보고
-- 조용히 넘어갔다면 여기서 멈춘다 (08-31 사고의 재발 방지).
do $$
begin
  assert (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'spot_day_stats'
      and column_name in ('spot_id', 'business_day_start', 'stats')
  ) = 3, 'spot_day_stats: 기대한 컬럼(spot_id, business_day_start, stats)이 없음';
  assert (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'menu_events'
      and column_name in ('spot_id', 'session_id', 'item_name', 'action')
  ) = 4, 'menu_events: 기대한 컬럼(spot_id, session_id, item_name, action)이 없음';
end $$;

commit;

-- PostgREST 스키마 캐시 갱신 — 이게 없으면 API가 "Could not find the table"을 계속 낸다.
notify pgrst, 'reload schema';
