-- Per-user (logged-in) behavior log on spots. UNLIKE spot_views / spot_visits
-- (anonymous counts — left completely untouched, so the public 조회수 is
-- unchanged), this ties each interaction to the Supabase auth user. That lets
-- us answer "which spots did user X view?", build taste profiles /
-- recommendations / retention cohorts, and an owner-facing "who showed
-- interest" — none of which GA4 (anonymous + aggregate) can do.
--
-- Forward-only: rows accrue from deploy time; there is no backfill of past
-- activity. Anonymous visitors generate NO rows here (user_id is NOT NULL);
-- their views still count in spot_views exactly as before.
--
-- Run in the Supabase SQL Editor.

create table if not exists user_spot_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  spot_id     uuid references spots(id) on delete cascade,   -- null for non-spot events (e.g. search)
  event_type  text not null check (event_type in (
                 'view', 'story_play', 'story_complete', 'visit',
                 'like', 'unlike', 'mood_up', 'mood_down', 'mood_clear',
                 'ig_click', 'checkin_pass', 'checkin_fail', 'search'
               )),
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists user_spot_events_user_idx on user_spot_events (user_id, created_at desc);
create index if not exists user_spot_events_spot_idx on user_spot_events (spot_id, event_type, created_at desc);

-- All writes go through service-role API routes; lock direct client access.
alter table user_spot_events enable row level security;

-- A logged-in user may read their OWN history (for a future "내 발자취" view);
-- everything else is service-role only.
drop policy if exists user_spot_events_select_self on user_spot_events;
create policy user_spot_events_select_self on user_spot_events
  for select to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
