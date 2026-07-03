-- 가게별 채팅방(#6). 인증 사장님(spot_members)이 직접 "개설"해야만 방이 생기고,
-- 유저는 개설된(open) 방에서만 로그인 상태로 읽기/쓰기. 실시간은 Supabase
-- Realtime(chat_messages만 노출). 신고는 기존 reports 테이블 재사용.
--
-- 설계 문서: docs/chat-design.md
-- Run in the Supabase SQL Editor. (CLI 링크 없음 — 수동 실행)
--
-- 안전한 실행 순서: 이 파일은 코드보다 먼저/나중 어느 쪽이든 안전하다.
--   - 유저 경로(chat_messages SELECT/INSERT)는 아래 정책이 있어야 동작.
--   - 사장님 경로(개설/닫기/공지/삭제/차단)는 서비스롤 API라 RLS 정책과 무관.

-- ============================================================
-- TABLES
-- ============================================================

-- 가게당 0~1개. PK가 곧 1:1 보장(별도 unique 불필요). 개설 = row 존재 + is_open.
create table if not exists chat_rooms (
  spot_id    uuid primary key references spots(id) on delete cascade,
  is_open    boolean not null default true,
  notice     text,                         -- 공지(핀). null = 공지 없음.
  opened_by  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 메시지. room PK(spot_id)를 직접 참조 → 방 없는 메시지 불가. 소프트삭제만.
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references chat_rooms(spot_id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,                -- 길이 제한(1~1000)은 API에서.
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
-- 방 메시지 페이지네이션(최신순)의 주 쿼리.
create index if not exists idx_chat_messages_spot_created
  on chat_messages (spot_id, created_at desc);

-- 차단. 복합 PK로 중복 차단 자동 방지(favorites 패턴). 목록은 비공개(SELECT 정책 없음).
create table if not exists chat_bans (
  spot_id    uuid not null references chat_rooms(spot_id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  banned_by  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);

-- ============================================================
-- HELPER FUNCTIONS (RLS 안에서 재귀/중복 서브쿼리 방지)
-- rate_limit_hit과 동일하게 SECURITY DEFINER + search_path 고정.
-- ============================================================

-- 그 가게 방이 존재하고 open 상태인가.
create or replace function chat_is_open(p_spot_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from chat_rooms r
    where r.spot_id = p_spot_id and r.is_open = true
  );
$$;

-- 그 방에서 이 유저가 차단됐나.
create or replace function chat_is_banned(p_spot_id uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from chat_bans b
    where b.spot_id = p_spot_id and b.user_id = p_user
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- 유저 읽기/쓰기 경로만 정책을 주고(=Realtime/PostgREST가 authenticated로 평가),
-- 사장님 변이·차단 목록은 정책 없이 서비스롤(requireMember)로만.
-- ============================================================

alter table chat_rooms    enable row level security;
alter table chat_messages enable row level security;
alter table chat_bans     enable row level security;

-- chat_rooms: 로그인 유저는 방 존재/open/공지를 읽을 수 있어야 함(빈 상태 분기·공지 표시).
-- 개설/닫기/공지 변경은 정책 없음 → 서비스롤(사장님 API)만.
drop policy if exists chat_rooms_select_auth on chat_rooms;
create policy chat_rooms_select_auth on chat_rooms
  for select to authenticated using (true);

-- chat_messages: open 방의 메시지는 로그인 유저 누구나 읽는다(삭제분 포함 — 클라가 가림).
drop policy if exists chat_messages_select_open on chat_messages;
create policy chat_messages_select_open on chat_messages
  for select to authenticated using (chat_is_open(spot_id));

-- 본인 메시지만, open 방에, 차단 안 됐을 때만 작성.
drop policy if exists chat_messages_insert_self on chat_messages;
create policy chat_messages_insert_self on chat_messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and chat_is_open(spot_id)
    and not chat_is_banned(spot_id, auth.uid())
  );

-- 소프트삭제(UPDATE)·삭제(DELETE)는 정책 없음 → 서비스롤(사장님 모더레이션)만.
-- chat_bans는 SELECT/INSERT/UPDATE/DELETE 모두 정책 없음 → 서비스롤만(목록 비공개).

-- ============================================================
-- REALTIME — chat_messages만 노출. rooms/bans는 노출 안 함.
-- 이미 publication에 들어가 있어도 에러 안 나게 가드.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;

-- ============================================================
-- REPORTS — 채팅 메시지 신고를 위해 target_type에 'chat_message' 추가.
-- 기존 데이터엔 post/comment만 있으므로 CHECK 교체는 무손실.
-- ============================================================

alter table reports drop constraint if exists reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'chat_message'));

notify pgrst, 'reload schema';
