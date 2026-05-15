-- Expand the map beyond Jeju. Adds a `city` column to spots so we can
-- group regions per city (Jeju has its own sub-regions; Seoul gets 9
-- 권역). Also bumps the spot_requests CHECK to allow the new Seoul
-- region values so user-submitted Seoul spots can be triaged through
-- the existing admin flow.
--
-- Run this in the Supabase SQL Editor. Idempotent.

-- ============================================================
-- 1. Add `city` to spots
-- ============================================================

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'jeju';

-- Existing rows are all Jeju, so the default covers them. Lock the
-- domain with a CHECK so a typo can't silently land a bad value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spots_city_check'
  ) THEN
    ALTER TABLE spots
      ADD CONSTRAINT spots_city_check CHECK (city IN ('jeju', 'seoul'));
  END IF;
END $$;

-- Filter index — most map/markers queries are now per-city.
CREATE INDEX IF NOT EXISTS spots_city_idx ON spots (city);

-- spots.region also carries a CHECK constraint (introduced earlier).
-- Expand it the same way as spot_requests so Seoul rows can land.
ALTER TABLE spots
  DROP CONSTRAINT IF EXISTS spots_region_check;

ALTER TABLE spots
  ADD CONSTRAINT spots_region_check
  CHECK (region IN (
    -- Jeju
    'jeju', 'aewol', 'seogwipo', 'east', 'west',
    -- Seoul (9 권역)
    'gangnam', 'songpa', 'hongdae', 'yongsan', 'seongsu',
    'jongno', 'yeongdeungpo', 'gwanak', 'seoul_north'
  ));

-- ============================================================
-- 2. Expand spot_requests.region CHECK (only if the table exists)
-- ============================================================
-- spots itself has no CHECK on region (it's a free-form text), so only
-- spot_requests needs an update. Some envs (dev) haven't applied the
-- 2026-04-24 admin migration yet — guard accordingly so this migration
-- doesn't fail there.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spot_requests'
  ) THEN
    ALTER TABLE spot_requests
      DROP CONSTRAINT IF EXISTS spot_requests_region_check;

    ALTER TABLE spot_requests
      ADD CONSTRAINT spot_requests_region_check
      CHECK (region IN (
        -- Jeju
        'jeju', 'aewol', 'seogwipo', 'east', 'west',
        -- Seoul (9 권역)
        'gangnam', 'songpa', 'hongdae', 'yongsan', 'seongsu',
        'jongno', 'yeongdeungpo', 'gwanak', 'seoul_north'
      ));
  END IF;
END $$;
