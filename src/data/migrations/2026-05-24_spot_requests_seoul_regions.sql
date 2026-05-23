-- Backfill / repair the spot_requests + reports tables so the '제안
-- 보내기' flow stops 500'ing.
--
-- Symptoms the user hit:
--   • POST /api/spot-requests → "Could not find the table
--     'public.spot_requests' in the schema cache"
--
-- Root causes addressed:
--   1. The original admin migration (2026-04-24) may never have been
--      applied in this Supabase project. CREATE TABLE IF NOT EXISTS
--      is idempotent, so re-running is safe.
--   2. The region CHECK constraint was hardcoded to the original 5
--      Jeju regions. Seoul 25구 + any future city were silently
--      rejected by the constraint after the 2026-05-15 city expansion.
--      We drop the CHECK; the API route validates against VALID_REGIONS
--      in code (`src/lib/types.ts`).
--   3. RLS policy + schema cache reload restated so PostgREST picks the
--      changes up without needing a manual restart.

-- 1) Ensure the table + indexes + RLS exist (idempotent).
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

-- 2) Drop the legacy region CHECK if present. The constraint name from
--    the original migration is auto-generated, so we drop by discovery.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'spot_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%region%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE spot_requests DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- 3) Re-create the anon INSERT policy (idempotent via DROP IF EXISTS).
DROP POLICY IF EXISTS "spot_requests_insert_anon" ON spot_requests;
CREATE POLICY "spot_requests_insert_anon"
  ON spot_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4) Tell PostgREST to reload its schema so the API sees the table
--    immediately instead of waiting for the next periodic refresh.
NOTIFY pgrst, 'reload schema';
