-- Expand the map to Busan (3rd city after Jeju + Seoul).
--
-- Busan districts (구) are prefixed `busan_` because the bare names
-- collide with Seoul's: Busan 중구/서구/강서구/남구/북구/동구 would clash
-- with Seoul's 'jung'/'gangseo' etc. on the shared `region` text column.
-- All 16 Busan districts are added to the vocabulary (matches how Seoul
-- seeded all 25 구) so user spot-requests work from any Busan district,
-- even though we currently only have spots in 수영구/해운대구/부산진구.
--
-- Run in Supabase SQL Editor. Idempotent (CHECKs dropped + re-added).

-- ============================================================
-- 1. Allow 'busan' as a city
-- ============================================================

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_city_check;
ALTER TABLE spots ADD CONSTRAINT spots_city_check
  CHECK (city IN ('jeju', 'seoul', 'busan'));

-- ============================================================
-- 2. Add Busan 구 codes to the region vocabulary (spots)
-- ============================================================

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  -- Jeju
  'jeju', 'aewol', 'seogwipo', 'east', 'west',
  -- Seoul (25 구)
  'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
  'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
  'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
  'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
  'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang',
  -- Busan (16 구·군) — busan_ prefix avoids collisions with Seoul names
  'busan_jung', 'busan_seo', 'busan_dong', 'busan_yeongdo',
  'busan_busanjin', 'busan_dongnae', 'busan_nam', 'busan_buk',
  'busan_haeundae', 'busan_saha', 'busan_geumjeong', 'busan_gangseo',
  'busan_yeonje', 'busan_suyeong', 'busan_sasang', 'busan_gijang'
));

-- ============================================================
-- 3. Same region vocabulary on spot_requests (guard if absent)
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
      'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
      'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
      'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
      'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
      'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang',
      'busan_jung', 'busan_seo', 'busan_dong', 'busan_yeongdo',
      'busan_busanjin', 'busan_dongnae', 'busan_nam', 'busan_buk',
      'busan_haeundae', 'busan_saha', 'busan_geumjeong', 'busan_gangseo',
      'busan_yeonje', 'busan_suyeong', 'busan_sasang', 'busan_gijang'
    ));
  END IF;
END $$;

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
