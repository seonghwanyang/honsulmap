-- Partner (사장님) portal foundation: owner↔spot membership, ownership claims,
-- and the VIP billing flag. Run in the Supabase SQL Editor.
--
-- Auth is Supabase Auth (already wired: Kakao/Google), so these tables key off
-- auth.users(id). RLS scopes reads to the logged-in user; all privileged writes
-- (approving a claim, creating a member row) go through the service-role
-- /api/partner & /api/admin endpoints, which bypass RLS after verifying the
-- session — so there is intentionally no INSERT policy on spot_members and no
-- UPDATE policy on spot_claims for end users.

-- VIP billing flag (Phase 2 uses it; harmless to add now).
alter table spots add column if not exists vip_until timestamptz;

-- 사장/매니저 ↔ 가게 (N:M + role). One franchise owner can hold many spots;
-- one spot can have several staff.
create table if not exists spot_members (
  spot_id    uuid not null references spots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'manager' check (role in ('owner','manager')),
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);
create index if not exists idx_spot_members_user on spot_members(user_id);

-- 소유권 주장: 사장님이 제출 → 운영자가 /admin에서 승인 → spot_members 생성.
create table if not exists spot_claims (
  id            uuid primary key default gen_random_uuid(),
  spot_id       uuid not null references spots(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner','manager')),
  evidence      text,            -- 사업자번호 / 가게 전화 / IG 등 본인 확인용
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_note text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
create index if not exists idx_spot_claims_status on spot_claims(status, created_at desc);
create index if not exists idx_spot_claims_user   on spot_claims(user_id);

alter table spot_members enable row level security;
alter table spot_claims  enable row level security;

-- A logged-in user may read only their own memberships / claims, and submit
-- their own claim. Everything else is service-role only.
drop policy if exists spot_members_select_self on spot_members;
create policy spot_members_select_self on spot_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists spot_claims_select_self on spot_claims;
create policy spot_claims_select_self on spot_claims
  for select to authenticated using (user_id = auth.uid());

drop policy if exists spot_claims_insert_self on spot_claims;
create policy spot_claims_insert_self on spot_claims
  for insert to authenticated with check (user_id = auth.uid());

notify pgrst, 'reload schema';
