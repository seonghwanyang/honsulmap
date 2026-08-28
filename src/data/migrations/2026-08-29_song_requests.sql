-- 신청곡(#테이블 서비스) — 손님이 좌석에서 곡을 신청하면 사장님 주문 보드에 뜨고,
-- 손님 채팅 탭 상단 큐에도 보인다. 접근은 전부 서비스롤 API 경유 (RLS 정책 없음).
-- Run in the Supabase SQL Editor. (CLI 링크 없음 — 수동 실행)

create table if not exists song_requests (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references spots(id) on delete cascade,
  session_id uuid references table_sessions(id) on delete set null,
  seat_label text not null,
  title      text not null,            -- 곡명 (1~60자, API에서 검증)
  artist     text,                     -- 가수 (선택, ~40자)
  status     text not null default 'queued' check (status in ('queued', 'played', 'skipped')),
  created_at timestamptz not null default now()
);

-- 보드/큐의 주 쿼리: 가게별 오늘 영업분 최신순.
create index if not exists idx_song_requests_spot_created
  on song_requests (spot_id, created_at desc);

-- 정책 없음 = 클라이언트 직접 접근 차단. 서비스롤 API만 읽고 쓴다.
alter table song_requests enable row level security;

notify pgrst, 'reload schema';
