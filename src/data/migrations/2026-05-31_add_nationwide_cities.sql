-- Phase 1 (additive, zero production risk): add 7 new cities + their
-- prefixed region codes to the vocabulary. Jeju/Seoul keep their legacy
-- bare codes for now — the off-peak retrofit to jeju_*/seoul_* is a
-- separate migration (2026-06-01_seoul_jeju_prefix_retrofit.sql).
--
-- This only WIDENS the CHECK constraints (no row UPDATEs), so existing
-- Jeju/Seoul/Busan rows and the live region filters keep working
-- unchanged. Safe to apply any time. Run in Supabase SQL Editor.

-- ============================================================
-- 1. Add 7 new cities to the city vocabulary
-- ============================================================
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_city_check;
ALTER TABLE spots ADD CONSTRAINT spots_city_check CHECK (city IN (
  'jeju','seoul','busan','incheon','daejeon','gwangju','daegu',
  'gyeonggi','chungbuk','jeonbuk'
));

-- ============================================================
-- 2. Widen region vocabulary: legacy bare Jeju/Seoul + busan_* + new
-- ============================================================
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  -- Jeju (legacy bare)
  'jeju','aewol','seogwipo','east','west',
  -- Seoul (legacy bare, 25 구)
  'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro',
  'geumcheon','nowon','dobong','dongdaemun','dongjak','mapo','seodaemun',
  'seocho','seongdong','seongbuk','songpa','yangcheon','yeongdeungpo',
  'yongsan','eunpyeong','jongno','jung','jungnang',
  -- Busan (16)
  'busan_jung','busan_seo','busan_dong','busan_yeongdo','busan_busanjin',
  'busan_dongnae','busan_nam','busan_buk','busan_haeundae','busan_saha',
  'busan_geumjeong','busan_gangseo','busan_yeonje','busan_suyeong','busan_sasang','busan_gijang',
  -- New cities (prefixed)
  'incheon_namdong','incheon_bupyeong',
  'daejeon_seo','daejeon_yuseong',
  'gwangju_seo','gwangju_dong',
  'daegu_jung',
  'gyeonggi_suwon','gyeonggi_ansan','gyeonggi_anyang','gyeonggi_bucheon',
  'chungbuk_cheongju','jeonbuk_jeonju'
));

-- ============================================================
-- 3. Same on spot_requests (guard if absent)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
    ALTER TABLE spot_requests ADD CONSTRAINT spot_requests_region_check CHECK (region IN (
      'jeju','aewol','seogwipo','east','west',
      'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro',
      'geumcheon','nowon','dobong','dongdaemun','dongjak','mapo','seodaemun',
      'seocho','seongdong','seongbuk','songpa','yangcheon','yeongdeungpo',
      'yongsan','eunpyeong','jongno','jung','jungnang',
      'busan_jung','busan_seo','busan_dong','busan_yeongdo','busan_busanjin',
      'busan_dongnae','busan_nam','busan_buk','busan_haeundae','busan_saha',
      'busan_geumjeong','busan_gangseo','busan_yeonje','busan_suyeong','busan_sasang','busan_gijang',
      'incheon_namdong','incheon_bupyeong',
      'daejeon_seo','daejeon_yuseong',
      'gwangju_seo','gwangju_dong',
      'daegu_jung',
      'gyeonggi_suwon','gyeonggi_ansan','gyeonggi_anyang','gyeonggi_bucheon',
      'chungbuk_cheongju','jeonbuk_jeonju'
    ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
