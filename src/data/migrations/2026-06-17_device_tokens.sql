-- 앱(FCM) 디바이스 푸시 토큰 저장. PR-4.
-- /api/devices 엔드포인트가 service-role 로만 upsert(onConflict: token).
-- 로그인 유저면 user_id 연결(타겟 푸시용), 비로그인이면 null.
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  platform    text not null,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

-- 클라이언트 직접 접근 차단: RLS 켜고 정책 없음 → service-role(서버)만 접근 가능.
alter table public.device_tokens enable row level security;
