-- Recreate the admin tables (spot_requests + reports) — BOTH went missing
-- from this Supabase project. Symptoms:
--   • POST /api/spot-requests ('가게 제안하기') → PGRST205
--     "Could not find the table 'public.spot_requests' in the schema cache"
--   • the report-content flow would 500 the same way (reports also absent).
-- Verified absent via PostgREST with the service-role key (404, not RLS),
-- so the original 2026-04-24 admin migration never landed (or was dropped)
-- in this project (kmhztgauczzqgqlehuow) even though `spots` is present.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + DROP POLICY IF EXISTS
-- before each CREATE POLICY, so re-running is safe. spot_requests is
-- created WITHOUT a region CHECK on purpose — the API validates region
-- against VALID_REGIONS in code (src/lib/types.ts); the old hardcoded
-- 5-region CHECK only ever silently rejected Seoul/Busan/nationwide.
-- Run in the Supabase SQL Editor.

-- ============================================================
-- spot_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS spot_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  ig_handle       TEXT,
  region          TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'bar'
                    CHECK (category IN ('bar', 'guesthouse')),
  address         TEXT,
  note            TEXT,
  fingerprint     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note   TEXT,
  created_spot_id UUID REFERENCES spots(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_spot_requests_status
  ON spot_requests (status, created_at DESC);

ALTER TABLE spot_requests ENABLE ROW LEVEL SECURITY;

-- The API uses the anon key, so anon needs INSERT. Reads go through the
-- admin endpoints with the service role (bypasses RLS) — no SELECT policy.
DROP POLICY IF EXISTS "spot_requests_insert_anon" ON spot_requests;
CREATE POLICY "spot_requests_insert_anon"
  ON spot_requests FOR INSERT TO anon WITH CHECK (true);

-- If a legacy spot_requests with the 5-region CHECK survives a re-run,
-- drop that CHECK (its name is auto-generated, so discover by definition).
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'spot_requests'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%region%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE spot_requests DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- ============================================================
-- reports
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id       UUID NOT NULL,
  reason          TEXT NOT NULL
                    CHECK (reason IN ('spam', 'abuse', 'illegal', 'other')),
  detail          TEXT,
  fingerprint     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolver_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  CONSTRAINT reports_unique_per_fingerprint
    UNIQUE (target_type, target_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target
  ON reports (target_type, target_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_anon" ON reports;
CREATE POLICY "reports_insert_anon"
  ON reports FOR INSERT TO anon WITH CHECK (true);

-- Reload PostgREST's schema cache so the API sees both tables immediately.
NOTIFY pgrst, 'reload schema';
