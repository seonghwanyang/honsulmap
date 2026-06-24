-- Fixed-window rate limiting for anonymous writes (post/comment/spot-request
-- creation). Backed by a single counter table + an atomic SECURITY DEFINER
-- function the API calls via supabaseAdmin().rpc('rate_limit_hit', ...).
--
-- Run in the Supabase SQL Editor. The API fails OPEN if this isn't applied yet
-- (rpc errors -> request allowed), so deploy ordering is not critical.

create table if not exists rate_limits (
  bucket       text not null,        -- e.g. 'post:create', 'comment:create'
  identifier   text not null,        -- client IP
  window_start timestamptz not null, -- start of the fixed window
  count        int not null default 0,
  primary key (bucket, identifier, window_start)
);

-- Service-role only. anon/authenticated never touch this table directly; the
-- SECURITY DEFINER function below is the sole writer.
alter table rate_limits enable row level security;

-- Atomic "hit": bump the counter for the current window and report whether the
-- caller is still within the limit. Returns true = allowed, false = throttled.
create or replace function rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_window_sec int,
  p_max int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_sec) * p_window_sec
  );
  v_count int;
begin
  insert into rate_limits (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, v_window, 1)
  on conflict (bucket, identifier, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- Optional housekeeping: drop windows older than a day so the table stays tiny.
-- (Safe to run periodically; not required for correctness.)
-- delete from rate_limits where window_start < now() - interval '1 day';

notify pgrst, 'reload schema';
