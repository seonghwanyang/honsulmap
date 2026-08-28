-- 토스플레이스 웹훅 이벤트 수신함 — 앱 설치/매장/카탈로그/주문/결제 이벤트를
-- 원본 그대로 보관한다 (어떤 이벤트를 어떻게 쓸지는 이후 결정 — 일단 유실 방지).
-- 접근은 서비스롤 API 전용 (RLS 정책 없음).
-- Run in the Supabase SQL Editor.

create table if not exists tossplace_events (
  id         uuid primary key default gen_random_uuid(),
  event_type text,
  payload    jsonb not null,
  headers    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tossplace_events_created
  on tossplace_events (created_at desc);

alter table tossplace_events enable row level security;

notify pgrst, 'reload schema';
