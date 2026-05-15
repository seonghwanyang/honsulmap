-- Fold the 4 spots in `seoul_north` into adjacent regions, then drop
-- the 'seoul_north' value from the region CHECK constraints. The name
-- "서울 동북부" was a placeholder bucket that didn't sit well; mapping
-- the spots by geographic proximity instead:
--   서대문(신촌), 은평(연신내) → hongdae
--   성북(성신여대), 노원         → jongno
--
-- Run in Supabase SQL Editor. Idempotent.

-- ============================================================
-- 1. Re-region the existing rows
-- ============================================================

UPDATE spots
  SET region = 'hongdae'
  WHERE region = 'seoul_north'
    AND slug IN ('9jeju-yeonsinnae', '9jeju-sinchon');

UPDATE spots
  SET region = 'jongno'
  WHERE region = 'seoul_north'
    AND slug IN ('9jeju-sungshin', '9jeju-nowon');

-- ============================================================
-- 2. Drop 'seoul_north' from the spots region CHECK
-- ============================================================

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  'jeju', 'aewol', 'seogwipo', 'east', 'west',
  'gangnam', 'songpa', 'hongdae', 'yongsan', 'seongsu',
  'jongno', 'yeongdeungpo', 'gwanak'
));

-- ============================================================
-- 3. Same for spot_requests CHECK (if the table is present)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spot_requests'
  ) THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
    ALTER TABLE spot_requests ADD CONSTRAINT spot_requests_region_check CHECK (region IN (
      'jeju', 'aewol', 'seogwipo', 'east', 'west',
      'gangnam', 'songpa', 'hongdae', 'yongsan', 'seongsu',
      'jongno', 'yeongdeungpo', 'gwanak'
    ));
  END IF;
END $$;
