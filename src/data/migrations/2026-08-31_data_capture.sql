-- 데이터 자산 3종 — 단골 인식·마감 스냅샷·메뉴 행동. 전부 익명(기기 해시/집계) 기반.
-- 접근은 서비스롤 API 전용 (RLS 정책 없음). Run in the Supabase SQL Editor.

-- ① 방문 기록 — 가게별 기기 해시(guest_key)로 영업일당 1행. 세션 정리와 무관하게 영구.
--    단골 지표: 같은 guest_key의 행 수 = 방문 일수. user_id는 나중에 계정 연결(스탬프) 대비.
create table if not exists spot_visits (
  id                 uuid primary key default gen_random_uuid(),
  spot_id            uuid not null references spots(id) on delete cascade,
  guest_key          text not null,           -- phone4_hash (기기+가게 해시, 가게 간 추적 불가)
  business_day_start timestamptz not null,    -- 영업일 경계(KST 06:00)
  user_id            uuid references auth.users(id) on delete set null,
  checkins           int not null default 1,  -- 같은 날 재체크인 횟수
  first_checkin_at   timestamptz not null default now(),
  unique (spot_id, guest_key, business_day_start)
);
create index if not exists idx_spot_visits_spot_guest on spot_visits (spot_id, guest_key);

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

alter table spot_visits    enable row level security;
alter table spot_day_stats enable row level security;
alter table menu_events    enable row level security;

NOTIFY pgrst, 'reload schema';
