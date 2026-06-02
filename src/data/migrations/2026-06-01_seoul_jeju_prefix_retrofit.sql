-- Phase 2 (off-peak / 새벽): retrofit the legacy bare Jeju/Seoul region
-- codes to the prefixed scheme so EVERY city is uniform (jeju_*, seoul_*,
-- busan_*, …). Busan + the 7 new cities are already prefixed.
--
-- ⚠️ PRODUCTION-AFFECTING. This UPDATEs region codes the live site reads.
-- Apply in lockstep with the matching code deploy (types.ts switches
-- Jeju/Seoul back to prefixed). Between the two, Seoul/Jeju 구 filters
-- briefly mismatch (city-level view is unaffected). Run during low
-- traffic, then deploy immediately.
--
-- Idempotent: the UPDATEs match bare codes via IN-lists, so a re-run
-- (already prefixed) is a no-op. Run in Supabase SQL Editor.

-- 1. Drop region CHECKs so the UPDATEs can land
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
  END IF;
END $$;

-- 2. Retrofit bare → prefixed
UPDATE spots SET region = 'jeju_' || region
  WHERE region IN ('jeju','aewol','seogwipo','east','west');
UPDATE spots SET region = 'seoul_' || region
  WHERE region IN (
    'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro',
    'geumcheon','nowon','dobong','dongdaemun','dongjak','mapo','seodaemun',
    'seocho','seongdong','seongbuk','songpa','yangcheon','yeongdeungpo',
    'yongsan','eunpyeong','jongno','jung','jungnang'
  );

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

-- 3. Re-add region CHECK with the fully-prefixed vocabulary
ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
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
