-- Nationwide expansion + region-code prefix unification.
--
-- Going nationwide means 구 names (중구·서구·동구·남구·북구) repeat across
-- 부산·대구·인천·광주·대전, so every city's region codes must carry a
-- `city_` prefix to stay globally unique on the shared `region` column.
-- This migration retrofits the two legacy bare-coded cities (Jeju, Seoul)
-- to the prefixed scheme and adds 7 new cities.
--
--   jeju/aewol/...        → jeju_jeju / jeju_aewol / ...
--   gangnam/mapo/...      → seoul_gangnam / seoul_mapo / ...
--   busan_*               → unchanged (already prefixed)
--   + incheon/daejeon/gwangju/daegu/gyeonggi/chungbuk/jeonbuk
--
-- ⚠️ The live site reads region codes. Apply this in lockstep with the
-- matching types.ts deploy — between the two, region filter chips for
-- Seoul/Jeju briefly mismatch (city values are unchanged, so the map
-- itself keeps working; only the 구 filter is affected).
--
-- Idempotent: the UPDATEs match bare codes via IN-lists, so a second run
-- (where codes are already prefixed) is a no-op. Run in Supabase SQL Editor.

-- ============================================================
-- 1. Drop region CHECKs so the UPDATEs can land
-- ============================================================
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
  END IF;
END $$;

-- ============================================================
-- 2. Retrofit Jeju + Seoul region codes to the prefixed scheme
-- ============================================================
UPDATE spots SET region = 'jeju_' || region
  WHERE region IN ('jeju','aewol','seogwipo','east','west');

UPDATE spots SET region = 'seoul_' || region
  WHERE region IN (
    'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro',
    'geumcheon','nowon','dobong','dongdaemun','dongjak','mapo','seodaemun',
    'seocho','seongdong','seongbuk','songpa','yangcheon','yeongdeungpo',
    'yongsan','eunpyeong','jongno','jung','jungnang'
  );

-- spot_requests carries the same bare codes from user submissions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    UPDATE spot_requests SET region = 'jeju_' || region
      WHERE region IN ('jeju','aewol','seogwipo','east','west');
    UPDATE spot_requests SET region = 'seoul_' || region
      WHERE region IN (
        'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro',
        'geumcheon','nowon','dobong','dongdaemun','dongjak','mapo','seodaemun',
        'seocho','seongdong','seongbuk','songpa','yangcheon','yeongdeungpo',
        'yongsan','eunpyeong','jongno','jung','jungnang'
      );
  END IF;
END $$;

-- ============================================================
-- 3. Expand the city vocabulary (add 7 new cities)
-- ============================================================
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_city_check;
ALTER TABLE spots ADD CONSTRAINT spots_city_check CHECK (city IN (
  'jeju','seoul','busan','incheon','daejeon','gwangju','daegu',
  'gyeonggi','chungbuk','jeonbuk'
));

-- ============================================================
-- 4. Re-add region CHECKs with the full prefixed vocabulary
-- ============================================================
-- Inline IN-lists (matching the existing migration style). Only region
-- codes we have (or imminently expect) data for are listed; extend with
-- a small follow-up migration when a new 구 lands.

ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  -- Jeju (5)
  'jeju_jeju','jeju_aewol','jeju_seogwipo','jeju_east','jeju_west',
  -- Seoul (25)
  'seoul_gangnam','seoul_gangdong','seoul_gangbuk','seoul_gangseo','seoul_gwanak',
  'seoul_gwangjin','seoul_guro','seoul_geumcheon','seoul_nowon','seoul_dobong',
  'seoul_dongdaemun','seoul_dongjak','seoul_mapo','seoul_seodaemun','seoul_seocho',
  'seoul_seongdong','seoul_seongbuk','seoul_songpa','seoul_yangcheon','seoul_yeongdeungpo',
  'seoul_yongsan','seoul_eunpyeong','seoul_jongno','seoul_jung','seoul_jungnang',
  -- Busan (16)
  'busan_jung','busan_seo','busan_dong','busan_yeongdo','busan_busanjin',
  'busan_dongnae','busan_nam','busan_buk','busan_haeundae','busan_saha',
  'busan_geumjeong','busan_gangseo','busan_yeonje','busan_suyeong','busan_sasang','busan_gijang',
  -- Incheon / Daejeon / Gwangju / Daegu
  'incheon_namdong','incheon_bupyeong',
  'daejeon_seo','daejeon_yuseong',
  'gwangju_seo','gwangju_dong',
  'daegu_jung',
  -- Gyeonggi (시 단위) / Chungbuk / Jeonbuk
  'gyeonggi_suwon','gyeonggi_ansan','gyeonggi_anyang','gyeonggi_bucheon',
  'chungbuk_cheongju','jeonbuk_jeonju'
));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    ALTER TABLE spot_requests ADD CONSTRAINT spot_requests_region_check CHECK (region IN (
      'jeju_jeju','jeju_aewol','jeju_seogwipo','jeju_east','jeju_west',
      'seoul_gangnam','seoul_gangdong','seoul_gangbuk','seoul_gangseo','seoul_gwanak',
      'seoul_gwangjin','seoul_guro','seoul_geumcheon','seoul_nowon','seoul_dobong',
      'seoul_dongdaemun','seoul_dongjak','seoul_mapo','seoul_seodaemun','seoul_seocho',
      'seoul_seongdong','seoul_seongbuk','seoul_songpa','seoul_yangcheon','seoul_yeongdeungpo',
      'seoul_yongsan','seoul_eunpyeong','seoul_jongno','seoul_jung','seoul_jungnang',
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
